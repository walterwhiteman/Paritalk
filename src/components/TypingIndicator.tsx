import React from 'react';

interface TypingIndicatorProps {
  username: string;
  isDarkMode?: boolean;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ 
  username, 
  isDarkMode = false 
}) => {
  return (
    <div className="flex items-center space-x-2 px-6 py-2">
      <div className={`rounded-2xl px-4 py-2 flex items-center space-x-2 ${
        isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
      }`}>
        <span className={`text-sm ${
          isDarkMode ? 'text-gray-300' : 'text-gray-600'
        }`}>
          {username} is typing
        </span>
        <div className="flex space-x-1">
          <div className={`w-2 h-2 rounded-full animate-bounce ${
            isDarkMode ? 'bg-gray-400' : 'bg-gray-400'
          }`} style={{ animationDelay: '0s' }}></div>
          <div className={`w-2 h-2 rounded-full animate-bounce ${
            isDarkMode ? 'bg-gray-400' : 'bg-gray-400'
          }`} style={{ animationDelay: '0.1s' }}></div>
          <div className={`w-2 h-2 rounded-full animate-bounce ${
            isDarkMode ? 'bg-gray-400' : 'bg-gray-400'
          }`} style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  );
};