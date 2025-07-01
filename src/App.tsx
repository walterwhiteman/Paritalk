import React, { useState, useEffect } from 'react';
import { LoginForm } from './components/LoginForm';
import { ChatHeader } from './components/ChatHeader';
import { MessageBubble } from './components/MessageBubble';
import { MessageInput } from './components/MessageInput';
import { TypingIndicator } from './components/TypingIndicator';
import { VideoCall } from './components/VideoCall';
import { IncomingCallModal } from './components/IncomingCallModal';
import { useFirebaseChat } from './hooks/useFirebaseChat';
import { useSupabaseStorage } from './hooks/useSupabaseStorage';
import { useVideoCallSignaling } from './hooks/useVideoCallSignaling';

interface AppState {
  isLoggedIn: boolean;
  username: string;
  roomCode: string;
  showVideoCall: boolean;
  isDarkMode: boolean;
}

function App() {
  const [state, setState] = useState<AppState>({
    isLoggedIn: false,
    username: '',
    roomCode: '',
    showVideoCall: false,
    isDarkMode: false
  });

  const {
    messages,
    users,
    isConnected,
    sendMessage,
    setTyping,
    addReaction,
    getPartnerTypingStatus,
    getPartnerOnlineStatus
  } = useFirebaseChat(state.roomCode, state.username);

  const { uploadFile, uploading } = useSupabaseStorage();

  const {
    incomingCall,
    acceptCall,
    rejectCall,
    initiateCall
  } = useVideoCallSignaling(state.roomCode, state.username, (accepted) => {
    if (accepted) {
      setState(prev => ({ ...prev, showVideoCall: true }));
    }
  });

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('SW registered: ', registration);
        })
        .catch(registrationError => {
          console.log('SW registration failed: ', registrationError);
        });
    }
  }, []);

  // Load dark mode preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('paritalk-theme');
    if (savedTheme === 'dark') {
      setState(prev => ({ ...prev, isDarkMode: true }));
    }
  }, []);

  // Apply dark mode class to document
  useEffect(() => {
    if (state.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.isDarkMode]);

  const handleLogin = (username: string, roomCode: string) => {
    setState(prev => ({
      ...prev,
      isLoggedIn: true,
      username,
      roomCode
    }));
  };

  const handleLeaveRoom = () => {
    setState({
      isLoggedIn: false,
      username: '',
      roomCode: '',
      showVideoCall: false,
      isDarkMode: state.isDarkMode
    });
  };

  const handleSendMessage = async (text: string) => {
    await sendMessage(text);
  };

  const handleSendFile = async (file: File) => {
    const fileUrl = await uploadFile(file);
    if (fileUrl) {
      const isImage = file.type.startsWith('image/');
      await sendMessage(
        `Shared ${isImage ? 'image' : 'file'}: ${file.name}`,
        isImage ? 'image' : 'file',
        fileUrl,
        file.name
      );
    }
  };

  const handleVideoCall = async () => {
    const partnerOnline = getPartnerOnlineStatus();
    if (!partnerOnline) {
      return;
    }

    try {
      await initiateCall();
    } catch (error) {
      console.error('Failed to start call:', error);
    }
  };

  const handleCloseVideoCall = () => {
    setState(prev => ({ ...prev, showVideoCall: false }));
  };

  const handleReaction = async (messageId: string, reaction: string) => {
    await addReaction(messageId, reaction);
  };

  const handleTyping = async (isTyping: boolean) => {
    await setTyping(isTyping);
  };

  const toggleDarkMode = () => {
    const newDarkMode = !state.isDarkMode;
    setState(prev => ({ ...prev, isDarkMode: newDarkMode }));
    localStorage.setItem('paritalk-theme', newDarkMode ? 'dark' : 'light');
  };

  const handleAcceptCall = () => {
    acceptCall();
    setState(prev => ({ ...prev, showVideoCall: true }));
  };

  const handleRejectCall = () => {
    rejectCall();
  };

  const partnerTyping = getPartnerTypingStatus();
  const isPartnerOnline = getPartnerOnlineStatus();

  if (!state.isLoggedIn) {
    return <LoginForm onLogin={handleLogin} isDarkMode={state.isDarkMode} onToggleDarkMode={toggleDarkMode} />;
  }

  return (
    <div className={`min-h-screen flex flex-col relative ${
      state.isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      {/* Fixed header for mobile */}
      <div className="fixed top-0 left-0 right-0 z-40">
        <ChatHeader
          roomCode={state.roomCode}
          username={state.username}
          isPartnerOnline={isPartnerOnline}
          onVideoCall={handleVideoCall}
          onLeaveRoom={handleLeaveRoom}
          isDarkMode={state.isDarkMode}
          onToggleDarkMode={toggleDarkMode}
        />
      </div>
      
      {/* Messages container with proper spacing for fixed header/footer */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 mt-20 mb-20 pb-safe">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.sender === state.username}
            onReaction={handleReaction}
            isDarkMode={state.isDarkMode}
            isPartnerOnline={isPartnerOnline}
          />
        ))}
        
        {partnerTyping && (
          <TypingIndicator username={partnerTyping.username} isDarkMode={state.isDarkMode} />
        )}
      </div>
      
      {/* Fixed input for mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-40 pb-safe">
        <MessageInput
          onSendMessage={handleSendMessage}
          onSendFile={handleSendFile}
          onTyping={handleTyping}
          isDarkMode={state.isDarkMode}
          onToggleDarkMode={toggleDarkMode}
        />
      </div>
      
      {state.showVideoCall && (
        <VideoCall
          roomCode={state.roomCode}
          username={state.username}
          onClose={handleCloseVideoCall}
          isDarkMode={state.isDarkMode}
        />
      )}

      {incomingCall && (
        <IncomingCallModal
          callerName={incomingCall.caller}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
          isDarkMode={state.isDarkMode}
        />
      )}
    </div>
  );
}

export default App;
