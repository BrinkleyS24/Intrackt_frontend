import React, { useState } from 'react';
import { showNotification } from './Notification';

export default function RemindButton({ threadId, label = 'Remind Later', defaultDelayHours = 24 }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async (e) => {
    e.stopPropagation();
    if (!threadId) {
      showSafe('Missing thread id for reminder', 'error');
      return;
    }
    try {
      setLoading(true);
      const when = Date.now() + defaultDelayHours * 60 * 60 * 1000;
      await sendMessageSafe({
        type: 'CREATE_REMINDER',
        payload: { threadId, when }
      });
      showSafe('Reminder scheduled', 'success');
    } catch (err) {
      showSafe('Failed to schedule reminder', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-zinc-600 px-3 py-1 text-sm ${loading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-zinc-700'}`}
      title={label}
    >
      {loading ? 'Scheduling…' : label}
    </button>
  );
}

function sendMessageSafe(message) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(message, (res) => {
          const err = chrome.runtime.lastError;
          if (err) return reject(err);
          resolve(res);
        });
      } else {
        // Fallback for non-extension contexts
        resolve({ ok: true, emulated: true });
      }
    } catch (e) {
      reject(e);
    }
  });
}

function showSafe(msg, type = 'info') {
  try { showNotification(msg, type); } catch (_) {}
}
