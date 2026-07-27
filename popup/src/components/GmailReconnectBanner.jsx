/**
 * @file popup/src/components/GmailReconnectBanner.jsx
 * @description Persistent banner shown when Applendium's Gmail authorization is
 * dead and nothing new is being tracked.
 *
 * Deliberately NOT dismissible. Every other signal for this state was easy to
 * miss — a 15-second toast that only fired on a manual sync the user had no
 * reason to run — and four real users sat dark for up to 102 days as a result.
 * While this is showing, the pipeline below it is frozen, so there is nothing
 * for the user to get back to by dismissing it.
 */

import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { deriveGmailConnectionState } from '../utils/gmailConnection.mjs';

function GmailReconnectBanner({ gmailAuth, onReconnect }) {
  const [isReconnecting, setIsReconnecting] = useState(false);
  const state = deriveGmailConnectionState(gmailAuth);

  if (!state.requiresReconnect) return null;

  const handleReconnect = async () => {
    if (isReconnecting) return;
    setIsReconnecting(true);
    try {
      await onReconnect();
    } finally {
      setIsReconnecting(false);
    }
  };

  return (
    <div
      data-testid="gmail-reconnect-banner"
      className="flex items-start justify-between gap-3 border-b border-destructive/25 bg-destructive/[0.10] px-4 py-2.5 text-left text-xs text-foreground"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
        <div className="space-y-0.5">
          <p className="font-semibold">{state.headline}</p>
          <p className="text-muted-foreground">{state.detail}</p>
          <p className="text-muted-foreground">{state.cause} Everything already tracked is safe.</p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleReconnect}
        disabled={isReconnecting}
        data-testid="gmail-reconnect-button"
        className="shrink-0 rounded-md bg-destructive px-3 py-1.5 font-medium text-destructive-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {isReconnecting ? 'Reconnecting...' : 'Reconnect'}
      </button>
    </div>
  );
}

export default GmailReconnectBanner;
