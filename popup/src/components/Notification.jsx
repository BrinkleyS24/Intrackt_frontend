/**
 * @file popup/src/components/Notification.jsx
 * @description Global notification (toast) component for displaying messages.
 * Refactored to use a queue for robust global message handling.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

// --- Global Notification System ---
// A queue to hold notification messages.
const notificationQueue = [];
// A ref to store the internal function that processes the queue.
const processQueueRef = { current: () => {} };

/**
 * Global function to show a notification. This is the public API.
 * It enqueues the notification and triggers the processor.
 * @param {string} msg - The message to display.
 * @param {'info'|'success'|'warning'|'error'} [msgType='info'] - Type of notification.
 * @param {Function|null} [undoFunc=null] - Function to call if 'undo' is clicked.
 * @param {number} [timeout=5000] - Duration before notification dismisses.
 */
export const showNotification = (msg, msgType = 'info', undoFunc = null, timeout = 5000) => {
  notificationQueue.push({ msg, msgType, undoFunc, timeout });
  // If the processor function has been set (i.e., Notification component has mounted), call it.
  // Otherwise, messages will wait in the queue until it's ready.
  if (processQueueRef.current) {
    processQueueRef.current();
  }
};

// --- Notification React Component ---
export const Notification = () => {
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [isVisible, setIsVisible] = useState(false);
  const [undoAction, setUndoAction] = useState(null);
  const [undoTimeoutId, setUndoTimeoutId] = useState(null);
  const hideTimeoutIdRef = useRef(null); // Ref to manage the hide timeout

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setMessage('');
    setType('info');
    setUndoAction(null);
    if (undoTimeoutId) {
      clearTimeout(undoTimeoutId);
      setUndoTimeoutId(null);
    }
    if (hideTimeoutIdRef.current) {
      clearTimeout(hideTimeoutIdRef.current);
      hideTimeoutIdRef.current = null;
    }
  }, [undoTimeoutId]);

  const handleUndoClick = useCallback(() => {
    if (undoAction) {
      undoAction(); // Execute the undo function
      handleDismiss(); // Dismiss the notification
    }
  }, [undoAction, handleDismiss]);

  // Function to display a notification from the queue
  const displayNotification = useCallback(({ msg, msgType, undoFunc, timeout }) => {
    // Clear any existing timeouts before displaying a new notification
    if (undoTimeoutId) clearTimeout(undoTimeoutId);
    if (hideTimeoutIdRef.current) clearTimeout(hideTimeoutIdRef.current);

    setMessage(msg);
    setType(msgType);
    setUndoAction(() => undoFunc); // Store the undo function
    setIsVisible(true);

    // Set a new timeout to hide the notification
    const newTimeoutId = setTimeout(() => {
      handleDismiss();
    }, timeout);

    if (undoFunc) {
      setUndoTimeoutId(newTimeoutId); // Keep track if it's an undoable toast
    } else {
      hideTimeoutIdRef.current = newTimeoutId; // For non-undoable toasts
    }
  }, [handleDismiss, undoTimeoutId]);


  // Effect to process the notification queue
  useEffect(() => {
    // This function will be stored in the global ref
    processQueueRef.current = () => {
      if (notificationQueue.length > 0 && !isVisible) {
        const nextNotification = notificationQueue.shift(); // Get the next notification
        displayNotification(nextNotification);
      }
    };

    // Initial check in case messages were enqueued before mount
    processQueueRef.current();

    // Cleanup: Clear the ref on unmount
    return () => {
      processQueueRef.current = null;
      if (hideTimeoutIdRef.current) clearTimeout(hideTimeoutIdRef.current);
      if (undoTimeoutId) clearTimeout(undoTimeoutId);
    };
  }, [displayNotification, isVisible, undoTimeoutId]); // isVisible ensures it only tries to display when not currently showing one.

  const bgColor = {
    info: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
  }[type];

  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white z-50 transition-all duration-300 ${bgColor} flex items-center space-x-4`}
      style={{ minWidth: '250px' }}
    >
      <span>{message}</span>
      {undoAction && (
        <button
          onClick={handleUndoClick}
          className="ml-auto px-3 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-md text-sm font-semibold transition-colors duration-200"
        >
          Undo
        </button>
      )}
      <button onClick={handleDismiss} className="ml-2 text-white opacity-70 hover:opacity-100 transition-opacity">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x">
          <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
        </svg>
      </button>
    </div>
  );
};
