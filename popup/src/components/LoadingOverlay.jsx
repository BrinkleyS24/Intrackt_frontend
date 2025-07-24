/**
 * @file popup/src/components/LoadingOverlay.jsx
 * @description A simple React component for a full-screen loading overlay.
 */

import React from 'react';

function LoadingOverlay() {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
    </div>
  );
}

export default LoadingOverlay;
