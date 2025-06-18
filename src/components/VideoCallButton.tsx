import React, { useState } from 'react';
import { Video, Phone } from 'lucide-react';

interface VideoCallButtonProps {
  onStartCall: () => void;
  disabled?: boolean;
}

export const VideoCallButton: React.FC<VideoCallButtonProps> = ({ 
  onStartCall, 
  disabled = false 
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onStartCall}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative p-3 rounded-full transition-all duration-300 transform
        ${disabled 
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
          : 'bg-green-500 text-white hover:bg-green-600 hover:scale-110 active:scale-95'
        }
        ${isHovered && !disabled ? 'shadow-lg shadow-green-500/30' : ''}
      `}
      title={disabled ? 'Partner is offline' : 'Start video call'}
    >
      <Video className="w-5 h-5" />
      
      {/* Ripple effect */}
      {isHovered && !disabled && (
        <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-30" />
      )}
    </button>
  );
};