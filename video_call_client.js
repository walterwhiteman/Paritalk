// video_call_client.js

// Import Socket.IO client library (for connecting to signaling server)
// Make sure this URL is correct for your environment, typically the latest CDN or npm package
import { io } from 'https://cdn.socket.io/4.7.5/socket.io.esm.min.js';

let socket = null; // WebSocket connection to signaling server
let localStream = null; // Our local audio/video stream
let peerConnections = {}; // Stores RTCPeerConnection objects for each peer
let roomCode = null;
let userId = null;
let username = null;
let uiCallbacks = {}; // Callbacks to update the UI in video_call.html

const STUN_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
];

// --- Initialization Function ---
export function initWebRTCClient(signalingServerUrl, currentRoomCode, currentUsername, callbacks) {
    roomCode = currentRoomCode;
    username = currentUsername;
    userId = `user_${Date.now()}`; // Generate a unique user ID for signaling
    uiCallbacks = callbacks;

    uiCallbacks.onStatusUpdate('Connecting to signaling server...');
    socket = io(signalingServerUrl);

    // --- Socket.IO Event Handlers ---

    socket.on('connect', () => {
        console.log('Connected to signaling server');
        uiCallbacks.onStatusUpdate('Connected to signaling server. Joining room...');
        socket.emit('join_room', { roomCode: roomCode, userId: userId, username: username });
    });

    socket.on('connect_error', (err) => {
        console.error('Socket.IO connection error:', err);
        uiCallbacks.onStatusUpdate(`Signaling server connection failed: ${err.message}.`);
        hangup(); // End call if signaling server connection fails
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from signaling server');
        uiCallbacks.onStatusUpdate('Disconnected from signaling server. Call ended.');
        hangup();
    });

    socket.on('room_joined', (data) => {
        console.log(`Joined room ${data.roomCode}. Peers:`, data.peers);
        uiCallbacks.onStatusUpdate(`Joined room ${data.roomCode}.`);
        startLocalStream(); // Get local media after joining room
        // If there are existing peers, initiate offers to them
        data.peers.forEach(peer => {
            if (peer.userId !== userId) { // Don't try to connect to ourselves
                createPeerConnection(peer.userId, peer.socketId, true); // True to create offer
            }
        });
    });

    socket.on('join_failed', (data) => {
        console.error('Failed to join room:', data.message);
        uiCallbacks.onStatusUpdate(`Failed to join room: ${data.message}`);
        hangup();
    });

    socket.on('room_full', (data) => {
        console.warn('Room is full:', data.message);
        uiCallbacks.onStatusUpdate(`Call could not be started: ${data.message}`);
        hangup();
    });

    socket.on('user_joined', (data) => {
        console.log(`User ${data.username} (${data.userId}) joined with socket ID ${data.socketId}`);
        uiCallbacks.onStatusUpdate(`User ${data.username} joined.`);
        // Only create peer connection if we don't have one for this user already
        if (!peerConnections[data.userId]) {
            createPeerConnection(data.userId, data.socketId, false); // False because they will send the offer
        }
    });

    socket.on('user_left', (data) => {
        console.log(`User ${data.username} (${data.userId}) left.`);
        uiCallbacks.onStatusUpdate(`User ${data.username} left the call.`);
        if (peerConnections[data.userId]) {
            peerConnections[data.userId].close();
            delete peerConnections[data.userId];
            uiCallbacks.onRemoteStreamEnded(); // Signal to remove remote video
        }
    });

    socket.on('offer', async (data) => {
        console.log('Received offer:', data.offer);
        const peerId = findUserIdBySocketId(data.senderSocketId);
        if (!peerId) {
            console.warn("Received offer from unknown sender socket ID:", data.senderSocketId);
            return;
        }

        let pc = peerConnections[peerId];
        if (!pc) { // Create PC if it doesn't exist (e.g., if this is the first signal from them)
             pc = createPeerConnection(peerId, data.senderSocketId, false);
        }

        try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('answer', { recipientSocketId: data.senderSocketId, answer: answer });
        } catch (e) {
            console.error('Error setting remote offer or creating answer:', e);
            uiCallbacks.onStatusUpdate('Video call error: ' + e.message);
        }
    });

    socket.on('answer', async (data) => {
        console.log('Received answer:', data.answer);
        const peerId = findUserIdBySocketId(data.senderSocketId);
        if (!peerId || !peerConnections[peerId]) {
            console.warn("Received answer from unknown or non-existent peer:", data.senderSocketId);
            return;
        }
        try {
            await peerConnections[peerId].setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (e) {
            console.error('Error setting remote answer:', e);
            uiCallbacks.onStatusUpdate('Video call error: ' + e.message);
        }
    });

    socket.on('ice_candidate', async (data) => {
        console.log('Received ICE candidate:', data.candidate);
        const peerId = findUserIdBySocketId(data.senderSocketId);
        if (!peerId || !peerConnections[peerId]) {
            console.warn("Received ICE candidate from unknown or non-existent peer:", data.senderSocketId);
            return;
        }
        try {
            const candidate = new RTCIceCandidate(data.candidate);
            await peerConnections[peerId].addIceCandidate(candidate);
        } catch (e) {
            console.error('Error adding received ICE candidate:', e);
            // This error might happen if a candidate is received after connection is established/closed.
            // It's often harmless but good to log.
        }
    });

    return {
        hangup: hangup // Expose hangup function to external callers
    };
}

// --- WebRTC Core Functions ---

async function startLocalStream() {
    uiCallbacks.onStatusUpdate('Requesting media access...');
    try {
        // Request both audio and video
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        uiCallbacks.onLocalStream(localStream);
        uiCallbacks.onStatusUpdate('Media access granted.');

        // Add local stream to all existing peer connections
        for (const pcId in peerConnections) {
            localStream.getTracks().forEach(track => {
                peerConnections[pcId].addTrack(track, localStream);
            });
        }
    } catch (e) {
        console.error('Error accessing media devices:', e);
        uiCallbacks.onStatusUpdate(`Failed to get camera/mic: ${e.message}. Please check permissions.`);
        // Optionally, still join the room but without local media
        hangup(); // Force hangup if no media access
    }
}

function createPeerConnection(peerId, peerSocketId, isCaller) {
    uiCallbacks.onStatusUpdate(`Establishing connection with ${peerId}...`);
    console.log(`Creating RTCPeerConnection for peerId: ${peerId}, socketId: ${peerSocketId}`);

    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
    peerConnections[peerId] = pc;

    // Add local stream tracks to the new peer connection if it exists
    if (localStream) {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
    }

    // Event: ICE Candidate
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('Sending ICE candidate:', event.candidate);
            socket.emit('ice_candidate', { recipientSocketId: peerSocketId, candidate: event.candidate });
        }
    };

    // Event: Remote Tracks Added
    pc.ontrack = (event) => {
        console.log('Remote track received:', event.streams[0]);
        // Assuming only one remote video stream for 1:1
        if (event.streams && event.streams[0]) {
            const remoteUsername = findUsernameBySocketId(peerSocketId) || 'Other User';
            uiCallbacks.onRemoteStream(event.streams[0], remoteUsername);
        }
    };

    // Event: Peer connection state changes
    pc.onconnectionstatechange = (event) => {
        console.log(`Peer connection state for ${peerId}: ${pc.connectionState}`);
        uiCallbacks.onStatusUpdate(`Call status: ${pc.connectionState}`);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            console.log(`Peer ${peerId} connection state: ${pc.connectionState}. Cleaning up.`);
            // uiCallbacks.onRemoteStreamEnded(); // Will be handled by user_left if signaling works
        }
    };

    // Create SDP offer if this peer is the caller
    if (isCaller) {
        pc.onnegotiationneeded = async () => {
            console.log('Negotiation needed: creating offer');
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('offer', { recipientSocketId: peerSocketId, offer: offer });
            } catch (e) {
                console.error('Error creating offer:', e);
                uiCallbacks.onStatusUpdate('Video call error: ' + e.message);
            }
        };
    }
    return pc;
}

// Helper to find userId from socketId
function findUserIdBySocketId(sId) {
    for (const userIdKey in peerConnections) {
        if (peerConnections[userIdKey].socketId === sId) {
            return userIdKey;
        }
    }
    // This is a simplified lookup assuming socketId is consistently stored
    // For a robust system, you might need a more comprehensive map on the server or client
    // For now, let's assume the socketId passed to createPeerConnection is the reference.
    // If not found in peerConnections (which stores by userId), maybe it's a new peer.
    // The signaling server should ideally send userId along with socketId in all signals.
    return Object.keys(peerConnections).find(id => peerConnections[id].__socketId === sId);
}

// Helper to find username by socketId (assuming username is associated with socket on server)
function findUsernameBySocketId(sId) {
    // This information should ideally come from the signaling server with user_joined or offer/answer
    // For now, we'll return a placeholder.
    // In a real app, the signaling server would send username with each signal.
    // The `user_joined` event already sends username.
    // We would need to store that username in `peerConnections` object
    return "Other User"; // Placeholder, needs actual data from signaling
}


// --- Hangup Function ---
export function hangup() {
    console.log("Ending video call...");
    if (socket) {
        socket.emit('leave_room', { roomCode: roomCode, userId: userId });
        socket.disconnect();
        socket = null;
    }

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    for (const peerId in peerConnections) {
        if (peerConnections[peerId]) {
            peerConnections[peerId].close();
            delete peerConnections[peerId];
        }
    }
    peerConnections = {};
    uiCallbacks.onHangup(); // Trigger UI cleanup in video_call.html
    console.log("Video call ended and resources cleaned up.");
}

