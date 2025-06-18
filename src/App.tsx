// src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { LoginForm } from './components/LoginForm';
import { ChatHeader } from './components/ChatHeader';
import { MessageBubble } from './components/MessageBubble';
import { MessageInput } from './components/MessageInput';
import { TypingIndicator } from './components/TypingIndicator';
import { Toast } from './components/Toast';
import { VideoCall } from './components/VideoCall';
import { MediaPreviewModal } from './components/MediaPreviewModal';
import { useFirebaseChat } from './hooks/useFirebaseChat';
import { useSupabaseStorage } from './hooks/useSupabaseStorage';

interface AppState {
  isLoggedIn: boolean;
  username: string;
  roomCode: string;
  showVideoCall: boolean;
  toast: string | null;
  isDarkMode: boolean;
}

function App() {
  const [state, setState] = useState<AppState>({
    isLoggedIn: false,
    username: '',
    roomCode: '',
    showVideoCall: false,
    toast: null,
    isDarkMode: false
  });

  const [showMediaPreview, setShowMediaPreview] = useState<boolean>(false);
  const [previewMediaUrl, setPreviewMediaUrl] = useState<string | null>(null);
  const [previewMediaType, setPreviewMediaType] = useState<'image' | 'video' | null>(null);

  const {
    messages,
    users,
    isConnected,
    sendMessage,
    setTyping,
    getPartnerTypingStatus,
    getPartnerOnlineStatus
  } = useFirebaseChat(state.roomCode, state.username);

  const { uploadFile, uploading } = useSupabaseStorage();

  const isVideoFileByExtension = (fileName: string) => {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
    const lowerCaseFileName = fileName.toLowerCase();
    return videoExtensions.some(ext => lowerCaseFileName.endsWith(ext));
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Effect to handle setting --vh for mobile viewport consistency
  useEffect(() => {
    const setVh = () => {
      document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    };
    setVh(); // Set on initial render
    window.addEventListener('resize', setVh); // Update on resize

    return () => window.removeEventListener('resize', setVh); // Cleanup
  }, []);

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

  useEffect(() => {
    const savedTheme = localStorage.getItem('paritalk-theme');
    if (savedTheme === 'dark') {
      setState(prev => ({ ...prev, isDarkMode: true }));
    }
  }, []);

  useEffect(() => {
    if (state.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.isDarkMode]);

  useEffect(() => {
    if (!state.isLoggedIn) return;

    const userIds = Object.keys(users);
    const currentUserCount = userIds.length;
    
    if (currentUserCount > 1) {
      const partnerUser = Object.values(users).find(user => user.username !== state.username);
      if (partnerUser && partnerUser.isOnline) {
        setState(prev => ({ ...prev, toast: `${partnerUser.username} joined the chat` }));
      }
    }
    if (state.toast) {
        const toastTimeout = setTimeout(() => {
            setState(prev => ({ ...prev, toast: null }));
        }, 3000);
        return () => clearTimeout(toastTimeout);
    }
  }, [users, state.username, state.isLoggedIn, state.toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      toast: null,
      isDarkMode: state.isDarkMode
    });
    setShowMediaPreview(false);
    setPreviewMediaUrl(null);
    setPreviewMediaType(null);
  };

  const handleSendMessage = async (text: string) => {
    await sendMessage(text);
  };

  const handleSendFile = async (file: File) => {
    const fileUrl = await uploadFile(file);
    if (fileUrl) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/') || isVideoFileByExtension(file.name);
      
      let messageType: 'text' | 'image' | 'file';
      let messageText = ''; 

      if (isImage) {
        messageType = 'image';
      } else if (isVideo) {
        messageType = 'file'; 
      } else {
        messageType = 'file'; 
        messageText = `Shared file: ${file.name}`;
      }

      await sendMessage(
        messageText, 
        messageType,
        fileUrl,
        file.name
      );
    } else {
      setState(prev => ({ ...prev, toast: 'Failed to upload file' }));
    }
  };

  const handleVideoCall = () => {
    setState(prev => ({ ...prev, showVideoCall: true }));
  };

  const handleCloseVideoCall = () => {
    setState(prev => ({ ...prev, showVideoCall: false }));
  };

  const handleTyping = async (isTyping: boolean) => {
    await setTyping(isTyping);
  };

  const handleMediaClick = (url: string, type: 'image' | 'video') => {
    setPreviewMediaUrl(url);
    setPreviewMediaType(type);
    setShowMediaPreview(true);
  };

  const handleCloseMediaPreview = () => {
    setShowMediaPreview(false);
    setPreviewMediaUrl(null);
    setPreviewMediaType(null);
  };

  const toggleDarkMode = () => {
    const newDarkMode = !state.isDarkMode;
    setState(prev => ({ ...prev, isDarkMode: newDarkMode }));
    localStorage.setItem('paritalk-theme', newDarkMode ? 'dark' : 'light');
  };

  const partnerTyping = getPartnerTypingStatus();
  const isPartnerOnline = getPartnerOnlineStatus();

  if (!state.isLoggedIn) {
    return <LoginForm onLogin={handleLogin} isDarkMode={state.isDarkMode} onToggleDarkMode={toggleDarkMode} />;
  }

  return (
    // Main container for the chat interface
    <div
      className={`flex flex-col relative overflow-x-hidden ${
        state.isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}
      style={{ height: 'calc(var(--vh, 1vh) * 100)' }} // Using --vh with fallback for consistent mobile viewport height
    >
      {/* Chat Header - Fixed Top */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 shadow-md">
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
      
      {/* Message List - Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-2 py-6 space-y-4 pt-20"> 
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.sender === state.username}
            isDarkMode={state.isDarkMode}
            onMediaClick={handleMediaClick}
          />
        ))}
        
        {/* MODIFIED: Explicit spacer div height changed from h-24 to h-20 */}
        {/* h-20 is 80px, very close to your measured input box height of 80.8px. */}
        {/* pb-safe is included to account for dynamic safe area height on mobile. */}
        <div className="h-10 pb-safe"></div> 

        <div ref={messagesEndRef} />

        {partnerTyping && (
          <TypingIndicator username={partnerTyping.username} isDarkMode={state.isDarkMode} />
        )}
      </div>
      
      {/* Message Input Box - Fixed Bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 shadow-lg pb-safe">
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
      
      {state.toast && (
        <Toast
          message={state.toast}
          onClose={() => setState(prev => ({ ...prev, toast: null }))}
          isDarkMode={state.isDarkMode}
        />
      )}

      {showMediaPreview && (
        <MediaPreviewModal
          isOpen={showMediaPreview}
          mediaUrl={previewMediaUrl}
          mediaType={previewMediaType}
          onClose={handleCloseMediaPreview}
        />
      )}
    </div>
  );
}

export default App;