import { useRef, useEffect, useState } from 'react';
import { ref, push, onValue, off } from 'firebase/database';
import { database } from '../config/firebase';

interface WebRTCHookProps {
  roomCode: string;
  username: string;
  onRemoteStream?: (stream: MediaStream) => void;
}

export const useWebRTC = ({ roomCode, username, onRemoteStream }: WebRTCHookProps) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    initializePeerConnection();
    setupSignaling();
    
    return () => {
      cleanup();
    };
  }, [roomCode, username]);

  const initializePeerConnection = () => {
    const peerConnection = new RTCPeerConnection(configuration);
    peerConnectionRef.current = peerConnection;

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignalingMessage({
          type: 'ice-candidate',
          candidate: event.candidate,
          sender: username
        });
      }
    };

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      const stream = event.streams[0];
      setRemoteStream(stream);
      onRemoteStream?.(stream);
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      setConnectionState(state);
      setIsConnected(state === 'connected');
    };

    return peerConnection;
  };

  const setupSignaling = () => {
    const signalingRef = ref(database, `signaling/${roomCode}`);
    
    const handleSignalingMessage = (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        Object.values(data).forEach((message: any) => {
          if (message.sender !== username) {
            handleRemoteSignalingMessage(message);
          }
        });
      }
    };

    onValue(signalingRef, handleSignalingMessage);
    
    return () => {
      off(signalingRef, 'value', handleSignalingMessage);
    };
  };

  const handleRemoteSignalingMessage = async (message: any) => {
    const peerConnection = peerConnectionRef.current;
    if (!peerConnection) return;

    try {
      switch (message.type) {
        case 'offer':
          await peerConnection.setRemoteDescription(message.offer);
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          sendSignalingMessage({
            type: 'answer',
            answer,
            sender: username
          });
          break;

        case 'answer':
          await peerConnection.setRemoteDescription(message.answer);
          break;

        case 'ice-candidate':
          await peerConnection.addIceCandidate(message.candidate);
          break;
      }
    } catch (error) {
      console.error('Error handling signaling message:', error);
    }
  };

  const sendSignalingMessage = (message: any) => {
    const signalingRef = ref(database, `signaling/${roomCode}`);
    push(signalingRef, {
      ...message,
      timestamp: Date.now()
    });
  };

  const startCall = async () => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setLocalStream(stream);
      localStreamRef.current = stream;

      const peerConnection = peerConnectionRef.current;
      if (!peerConnection) return;

      // Add tracks to peer connection
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      // Create and send offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      sendSignalingMessage({
        type: 'offer',
        offer,
        sender: username
      });

    } catch (error) {
      console.error('Error starting call:', error);
    }
  };

  const endCall = () => {
    cleanup();
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  };

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    setLocalStream(null);
    setRemoteStream(null);
    setIsConnected(false);
    setConnectionState('closed');
  };

  return {
    localStream,
    remoteStream,
    isConnected,
    connectionState,
    startCall,
    endCall,
    toggleAudio,
    toggleVideo
  };
};