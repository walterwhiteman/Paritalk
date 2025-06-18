// src/components/MediaPreviewModal.tsx
import React from 'react';
import { createPortal } from 'react-dom'; // Import createPortal
import { X } from 'lucide-react';

interface MediaPreviewModalProps {
  isOpen: boolean;
  mediaUrl: string | null;
  mediaType: 'image' | 'video' | null;
  onClose: () => void;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  isOpen,
  mediaUrl,
  mediaType,
  onClose,
}) => {
  // If the modal is not open, or essential props are missing, don't render anything
  if (!isOpen || !mediaUrl || !mediaType) {
    return null;
  }

  // Get the element to which the portal will attach.
  // We'll attach it directly to the document.body.
  const modalRoot = document.body;

  // Use createPortal to render the modal content directly into modalRoot
  return createPortal(
    <div
      className="
        fixed top-0 left-0 w-full h-full z-[1000] // Explicit width/height for better mobile coverage
        flex items-center justify-center // Center content horizontally and vertically
        bg-black bg-opacity-75 // Dark semi-transparent background
        p-4 // Padding around the content
      "
      onClick={onClose} // Close the modal when clicking on the background
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="
          absolute top-4 right-4 z-[1001] // **Increased z-index for the close button to ensure it's on top**
          text-white text-opacity-80 hover:text-opacity-100 // White text, fades on hover
          bg-gray-800 bg-opacity-50 hover:bg-opacity-75 // Semi-transparent dark background for button
          rounded-full p-2 // Circular button with padding
          focus:outline-none focus:ring-2 focus:ring-blue-500 // Focus styles
        "
        title="Close preview"
      >
        <X className="w-6 h-6" /> {/* 'X' icon */}
      </button>

      {/* Media content container, stops propagation so clicking on media doesn't close modal */}
      <div className="max-w-full max-h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {mediaType === 'image' && (
          <img
            src={mediaUrl}
            alt="Full size preview"
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
          />
        )}
        {mediaType === 'video' && (
          <video
            src={mediaUrl}
            controls // Show video controls for full-size playback
            autoPlay // Automatically play the video when opened
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
          />
        )}
      </div>
    </div>,
    modalRoot // This is where the modal content will be rendered in the DOM
  );
};