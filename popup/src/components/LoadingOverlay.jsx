/**
 * @file popup/src/components/LoadingOverlay.jsx
 * @description A simple React component for a full-screen loading overlay.
 * Enhanced to accept a message prop for dynamic loading text.
 */

import React from 'react';

function LoadingOverlay({ message = "Loading..." }) {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
        <p className="text-white text-lg font-semibold">{message}</p>
      </div>
    </div>
  );
}

export default LoadingOverlay;
