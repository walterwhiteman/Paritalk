import React, { useState } from 'react';
import { Download, Heart, ThumbsUp, Smile, MoreVertical, Check } from 'lucide-react';
import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  onReaction: (messageId: string, reaction: string) => void;
  isDarkMode?: boolean;
  isPartnerOnline?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  onReaction,
  isDarkMode = false,
  isPartnerOnline = false
}) => {
  const [showReactions, setShowReactions] = useState(false);
  
  const reactions = ['❤️', '👍', '😊', '😂', '😮', '😢'];
  
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handleReaction = (reaction: string) => {
    onReaction(message.id, reaction);
    setShowReactions(false);
  };

  const DeliveryStatus = () => {
    if (!isOwn) return null;
    
    return (
      <div className="flex items-center ml-1">
        {message.isDelivered ? (
          // Double tick (delivered - message was delivered when partner was online)
          <div className="relative">
            <Check className="w-3 h-3 text-gray-400" />
            <Check className="w-3 h-3 text-gray-400 absolute -right-1 top-0" />
          </div>
        ) : (
          // Single tick (sent - not yet delivered)
          <Check className="w-3 h-3 text-gray-400" />
        )}
      </div>
    );
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3 group`}>
      <div className={`max-w-xs lg:max-w-md relative ${isOwn ? 'order-2' : ''}`}>
        <div
          className={`rounded-2xl px-3 py-2 shadow-sm ${
            isOwn
              ? 'bg-blue-600 text-white'
              : isDarkMode
                ? 'bg-gray-700 text-gray-100'
                : 'bg-gray-100 text-gray-900'
          }`}
        >
          {message.type === 'text' && (
            <div>
              <p className="text-sm leading-relaxed mb-1">{message.text}</p>
              <div className="flex items-center justify-end space-x-1">
                <span className={`text-xs ${
                  isOwn ? 'text-blue-100' : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {formatTime(message.timestamp)}
                </span>
                <DeliveryStatus />
              </div>
            </div>
          )}
          
          {message.type === 'image' && (
            <div>
              <img
                src={message.fileUrl}
                alt="Shared image"
                className="rounded-lg max-w-full h-auto mb-2"
              />
              {message.text && (
                <p className="text-sm leading-relaxed mb-1">{message.text}</p>
              )}
              <div className="flex items-center justify-end space-x-1">
                <span className={`text-xs ${
                  isOwn ? 'text-blue-100' : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {formatTime(message.timestamp)}
                </span>
                <DeliveryStatus />
              </div>
            </div>
          )}
          
          {message.type === 'file' && (
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <Download className="w-4 h-4" />
                <a
                  href={message.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline hover:no-underline"
                >
                  {message.fileName}
                </a>
              </div>
              <div className="flex items-center justify-end space-x-1">
                <span className={`text-xs ${
                  isOwn ? 'text-blue-100' : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {formatTime(message.timestamp)}
                </span>
                <DeliveryStatus />
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center mt-1 space-x-2">
          <button
            onClick={() => setShowReactions(!showReactions)}
            className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded-full ${
              isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
            }`}
          >
            <Smile className={`w-3 h-3 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-400'
            }`} />
          </button>
        </div>
        
        {/* Reactions */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className="flex space-x-1 mt-2">
            {Object.entries(message.reactions).map(([userId, reaction]) => (
              <span key={userId} className={`text-xs px-2 py-1 shadow-sm rounded-full ${
                isDarkMode ? 'bg-gray-700' : 'bg-white'
              }`}>
                {reaction}
              </span>
            ))}
          </div>
        )}
        
        {/* Reaction picker */}
        {showReactions && (
          <div className={`absolute bottom-full mb-2 rounded-xl shadow-lg border p-2 z-10 ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <div className="flex space-x-1">
              {reactions.map((reaction) => (
                <button
                  key={reaction}
                  onClick={() => handleReaction(reaction)}
                  className={`text-lg rounded-lg p-1 transition-colors duration-200 ${
                    isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  }`}
                >
                  {reaction}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
