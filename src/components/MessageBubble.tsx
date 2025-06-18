// src/components/MessageBubble.tsx
import React, { useState } from 'react';
import { Plus } from 'lucide-react';

interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: Date;
  type?: 'text' | 'image' | 'file';
  fileUrl?: string;
  fileName?: string;
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isDarkMode: boolean;
  onMediaClick?: (url: string, type: 'image' | 'video') => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  isDarkMode,
  onMediaClick
}) => {
  const getBackgroundColor = () => {
    if (isOwn) {
      return isDarkMode ? 'bg-blue-600' : 'bg-blue-500';
    }
    return isDarkMode ? 'bg-gray-700' : 'bg-gray-200';
  };

  const getTextColor = () => {
    if (isOwn) {
      return 'text-white';
    }
    return isDarkMode ? 'text-white' : 'text-gray-800';
  };

  const getTimeColor = () => {
    return isDarkMode ? 'text-gray-400' : 'text-gray-500';
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isImageFile = (url: string) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const lowerCaseUrl = url.toLowerCase();
    return imageExtensions.some(ext => lowerCaseUrl.endsWith(ext));
  };

  const isVideoFile = (url: string) => {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
    const lowerCaseUrl = url.toLowerCase();
    return videoExtensions.some(ext => lowerCaseUrl.endsWith(ext));
  };

  const bubbleMaxWidthClasses =
    (message.type === 'image' || isVideoFile(message.fileUrl || ''))
      ? 'max-w-[15rem]'
      : 'max-w-xs lg:max-w-md'; // Keeping fixed max-w as that fixed the 'Hii' issue

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        <div
          // MODIFIED: Changed px-3 py-3 back to px-2 py-2 for 0.5rem padding
          className={`rounded-md px-2 py-2 shadow-sm ${getBackgroundColor()} ${getTextColor()} ${bubbleMaxWidthClasses}`}
        >
          {message.type === 'image' && message.fileUrl ? (
            <img
              src={message.fileUrl}
              alt={message.fileName || 'Image'}
              className="max-w-full h-auto rounded-md object-cover cursor-pointer"
              style={{ maxHeight: '180px' }}
              onClick={() => onMediaClick && onMediaClick(message.fileUrl!, 'image')}
            />
          ) : message.type === 'file' && message.fileUrl && isVideoFile(message.fileUrl) ? (
            <div className="relative w-full h-auto">
              <video
                src={message.fileUrl}
                controls={false}
                preload="metadata"
                className="max-w-full h-auto rounded-md object-cover cursor-pointer"
                style={{ maxHeight: '180px' }}
                onClick={() => onMediaClick && onMediaClick(message.fileUrl!, 'video')}
              />
              <div
                className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-md cursor-pointer"
                onClick={() => onMediaClick && onMediaClick(message.fileUrl!, 'video')}
              >
                <Plus className="w-10 h-10 text-white" />
              </div>
            </div>
          ) : message.type === 'file' && message.fileUrl ? (
            <a
              href={message.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-200 dark:text-blue-300 hover:underline"
            >
              {message.fileName || 'Shared File'}
            </a>
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.text}</p>
          )}
        </div>
        <span className={`text-xs mt-1 ${getTimeColor()} ${isOwn ? 'text-right' : 'text-left'} whitespace-nowrap`}>
          {formatTimestamp(message.timestamp)}
        </span>
      </div>
    </div>
  );
};