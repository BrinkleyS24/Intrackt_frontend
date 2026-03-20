/**
 * @file popup/src/components/Notification.jsx
 * @description Global toast notification component for the popup.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';

const notificationQueue = [];
const processQueueRef = { current: () => {} };

export const showNotification = (msg, msgType = 'info', undoFunc = null, timeout = 3200) => {
  notificationQueue.push({ msg, msgType, undoFunc, timeout });
  if (processQueueRef.current) {
    processQueueRef.current();
  }
};

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: XCircle,
};

const COLOR_CLASSES = {
  info: 'border-primary/20 bg-primary text-primary-foreground',
  success: 'border-accent/20 bg-accent text-accent-foreground',
  warning: 'border-warning/25 bg-warning text-warning-foreground',
  error: 'border-destructive/25 bg-destructive text-destructive-foreground',
};

export const Notification = () => {
  const [currentNotification, setCurrentNotification] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const dismissTimerRef = useRef(null);
  const cleanupTimerRef = useRef(null);

  const clearTimers = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (cleanupTimerRef.current) {
      clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
  }, []);

  const processNext = useCallback(() => {
    if (currentNotification || notificationQueue.length === 0) return;
    const nextNotification = notificationQueue.shift();
    if (nextNotification) {
      setCurrentNotification(nextNotification);
    }
  }, [currentNotification]);

  const dismissNotification = useCallback(() => {
    clearTimers();
    setIsVisible(false);
    cleanupTimerRef.current = setTimeout(() => {
      setCurrentNotification(null);
    }, 180);
  }, [clearTimers]);

  const handleUndoClick = useCallback(() => {
    if (typeof currentNotification?.undoFunc === 'function') {
      currentNotification.undoFunc();
    }
    dismissNotification();
  }, [currentNotification, dismissNotification]);

  useEffect(() => {
    processQueueRef.current = processNext;
    if (!currentNotification) {
      processNext();
    }

    return () => {
      processQueueRef.current = null;
    };
  }, [currentNotification, processNext]);

  useEffect(() => {
    if (!currentNotification) return undefined;

    clearTimers();
    setIsVisible(true);
    dismissTimerRef.current = setTimeout(() => {
      dismissNotification();
    }, currentNotification.timeout ?? 3200);

    return () => {
      clearTimers();
    };
  }, [clearTimers, currentNotification, dismissNotification]);

  if (!currentNotification) return null;

  const Icon = ICONS[currentNotification.msgType] || ICONS.info;
  const colorClassName = COLOR_CLASSES[currentNotification.msgType] || COLOR_CLASSES.info;

  return (
    <div
      className={`pointer-events-none fixed bottom-3 right-3 z-50 transition-all duration-200 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      <div
        className={`pointer-events-auto flex max-w-[280px] items-center gap-2 rounded-2xl border px-3 py-2.5 shadow-[0_14px_30px_rgba(17,24,39,0.18)] ${colorClassName}`}
        role="status"
        aria-live="polite"
      >
        <Icon className="h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1 text-xs font-medium leading-5">
          {currentNotification.msg}
        </div>

        {currentNotification.undoFunc && (
          <button
            onClick={handleUndoClick}
            className="shrink-0 rounded-md bg-white/15 px-2 py-1 text-[11px] font-semibold transition hover:bg-white/25"
            type="button"
          >
            Undo
          </button>
        )}

        <button
          onClick={dismissNotification}
          className="shrink-0 rounded-full p-0.5 opacity-80 transition hover:bg-black/10 hover:opacity-100"
          aria-label="Dismiss notification"
          type="button"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
