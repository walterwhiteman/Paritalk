import React from 'react';
import { LogOut, Users, Moon, Sun } from 'lucide-react';
import { VideoCallButton } from './VideoCallButton';

interface ChatHeaderProps {
  roomCode: string;
  username: string;
  isPartnerOnline: boolean;
  onVideoCall: () => void;
  onLeaveRoom: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  roomCode,
  username,
  isPartnerOnline,
  onVideoCall,
  onLeaveRoom,
  isDarkMode,
  onToggleDarkMode
}) => {
  return (
    <header className={`${
      isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    } border-b px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between shadow-sm backdrop-blur-sm`}>
      <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
        <div className={`${
          isDarkMode ? 'bg-blue-900' : 'bg-blue-100'
        } w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0`}>
          <Users className={`w-4 h-4 sm:w-5 sm:h-5 ${
            isDarkMode ? 'text-blue-400' : 'text-blue-600'
          }`} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className={`font-semibold text-sm sm:text-base truncate ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Room: {roomCode}
          </h1>
          <p className={`text-xs sm:text-sm flex items-center ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <div 
              className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 ${
                isPartnerOnline ? 'bg-green-500' : 'bg-gray-400'
              }`} 
            />
            <span className="truncate">
              {isPartnerOnline ? 'Partner is online' : 'Partner is offline'}
            </span>
          </p>
        </div>
      </div>
      
      <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
        <button
          onClick={onToggleDarkMode}
          className={`p-2 rounded-xl transition-colors duration-200 ${
            isDarkMode 
              ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDarkMode ? (
            <Sun className="w-4 h-4 sm:w-5 sm:h-5" />
          ) : (
            <Moon className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </button>
        
        <VideoCallButton 
          onStartCall={onVideoCall}
          disabled={!isPartnerOnline}
          isDarkMode={isDarkMode}
        />
        
        <button
          onClick={onLeaveRoom}
          className={`p-2 rounded-xl transition-colors duration-200 ${
            isDarkMode
              ? 'bg-red-900 text-red-400 hover:bg-red-800'
              : 'bg-red-100 text-red-600 hover:bg-red-200'
          }`}
          title="Leave room"
        >
          <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>
    </header>
  );
};