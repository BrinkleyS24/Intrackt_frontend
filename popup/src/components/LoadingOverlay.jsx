/**
 * @file popup/src/components/LoadingOverlay.jsx
 * @description A simple React component for a full-screen loading overlay.
 * Enhanced to accept a message prop for dynamic loading text.
 */

import React from 'react';

function LoadingOverlay({ message = "Loading..." }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="flex flex-col items-center">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent"></div>
        <p className="text-lg font-semibold text-foreground">{message}</p>
      </div>
    </div>
  );
}

export default LoadingOverlay;
