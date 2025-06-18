import React, { useState, useRef } from 'react';
import { Send, Paperclip, Moon, Sun } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (text: string) => void;
  onSendFile: (file: File) => void;
  onTyping: (isTyping: boolean) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onSendFile,
  onTyping,
  isDarkMode,
  onToggleDarkMode
}) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
      handleTypingEnd();
    }
  };

  const handleTypingStart = () => {
    if (!isTyping) {
      setIsTyping(true);
      onTyping(true);
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      handleTypingEnd();
    }, 1000);
  };

  const handleTypingEnd = () => {
    setIsTyping(false);
    onTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    handleTypingStart();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSendFile(file);
    }
  };

  return (
    <div className={`${
      isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    } border-t px-4 sm:px-6 py-3 sm:py-4 backdrop-blur-sm`}>
      <form onSubmit={handleSubmit} className="flex items-center space-x-2 sm:space-x-3">
        <div className="flex space-x-1 sm:space-x-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`p-2 rounded-xl transition-colors duration-200 ${
              isDarkMode
                ? 'text-gray-400 hover:text-blue-400 hover:bg-gray-700'
                : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
            }`}
            title="Attach file"
          >
            <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          
          <button
            type="button"
            onClick={onToggleDarkMode}
            className={`p-2 rounded-xl transition-colors duration-200 ${
              isDarkMode
                ? 'text-yellow-400 hover:bg-gray-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <Moon className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>
        </div>
        
        <div className="flex-1 relative">
          <input
            type="text"
            value={message}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className={`w-full px-4 py-2 sm:py-3 rounded-2xl border-0 focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-sm sm:text-base ${
              isDarkMode
                ? 'bg-gray-700 text-white placeholder-gray-400 focus:bg-gray-600'
                : 'bg-gray-50 text-gray-900 placeholder-gray-500 focus:bg-white'
            }`}
          />
        </div>
        
        <button
          type="submit"
          disabled={!message.trim()}
          className="p-2 sm:p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex-shrink-0"
        >
          <Send className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </form>
      
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        accept="*/*"
      />
    </div>
  );
};