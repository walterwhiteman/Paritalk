import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
  isDarkMode?: boolean;
}

export const Toast: React.FC<ToastProps> = ({ 
  message, 
  onClose, 
  duration = 3000, 
  isDarkMode = false 
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
      <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 animate-fade-in ${
        isDarkMode 
          ? 'bg-gray-800 text-gray-100' 
          : 'bg-gray-800 text-white'
      }`}>
        <span className="text-sm">{message}</span>
        <button
          onClick={onClose}
          className={`transition-colors duration-200 ${
            isDarkMode 
              ? 'text-gray-400 hover:text-gray-200' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};