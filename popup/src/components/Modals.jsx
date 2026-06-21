/**
 * @file popup/src/components/Modals.jsx
 * @description Renders application modals (misclassification + undo toast).
 */

import React, { useEffect, useState } from 'react';
import { X, Flag } from 'lucide-react';

export default function Modals({
  isMisclassificationModalOpen,
  onCloseMisclassificationModal,
  selectedEmailForMisclassification,
  onConfirmMisclassification,
  undoToastVisible,
  setUndoToastVisible,
  undoMisclassification,
}) {
  const [selectedMisclassificationCategory, setSelectedMisclassificationCategory] = useState('irrelevant');

  const circumference = 2 * Math.PI * 14;
  const [strokeDashoffset, setStrokeDashoffset] = useState(circumference);

  useEffect(() => {
    if (!undoToastVisible) return;

    setStrokeDashoffset(circumference);
    const startTime = Date.now();
    const duration = 5000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setStrokeDashoffset(circumference * (1 - progress));
      if (progress === 1) {
        clearInterval(interval);
        setUndoToastVisible(false);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [undoToastVisible, circumference, setUndoToastVisible]);

  return (
    <>
      {isMisclassificationModalOpen && (
        <div
          id="misclassification-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity duration-300 opacity-100 visible"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 text-foreground shadow-xl">
            <button
              onClick={onCloseMisclassificationModal}
              className="absolute top-4 right-4 z-10 p-1 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6 text-center">
              <Flag className="mx-auto mb-3 h-12 w-12 text-destructive" />
              <h3 className="mb-2 text-xl font-semibold text-foreground">
                Misclassified Email?
              </h3>
              <p className="text-sm text-muted-foreground">
                This email was classified as:{' '}
                <span className="font-bold text-accent">
                  {selectedEmailForMisclassification?.category || 'N/A'}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Subject:{' '}
                <span className="font-semibold text-foreground">{selectedEmailForMisclassification?.subject || 'N/A'}</span>
              </p>
            </div>

            <div className="mb-6">
              <label
                htmlFor="correctCategory"
                className="mb-2 block text-sm font-medium text-secondary-foreground"
              >
                Move to:
              </label>
              <select
                id="correctCategory"
                className="mt-1 block w-full rounded-md border border-border bg-popover py-2 pl-3 pr-10 text-base text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 sm:text-sm"
                value={selectedMisclassificationCategory}
                onChange={(e) => setSelectedMisclassificationCategory(e.target.value)}
              >
                <option value="irrelevant">Irrelevant</option>
                <option value="applied">Applied</option>
                <option value="interviewed">Interviewed</option>
                <option value="offers">Offers</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={onCloseMisclassificationModal}
                className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  onConfirmMisclassification(selectedEmailForMisclassification, selectedMisclassificationCategory)
                }
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
              >
                Confirm Move
              </button>
            </div>
          </div>
        </div>
      )}

      {undoToastVisible && (
        <div
          id="undo-toast"
          className="fixed bottom-4 right-4 z-50 flex items-center space-x-4 rounded-lg border border-border bg-card p-4 text-foreground shadow-lg"
          style={{ minWidth: '250px' }}
        >
          <span>Email reported as irrelevant.</span>
          <svg id="undo-timer-svg" width="32" height="32" viewBox="0 0 32 32" className="flex-shrink-0">
            <circle r="14" cx="16" cy="16" fill="transparent" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
            <circle
              id="undo-timer-circle"
              r="14"
              cx="16"
              cy="16"
              fill="none"
              stroke="#fff"
              strokeWidth="3"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset linear 0.05s' }}
            />
          </svg>
          <button
            id="undo-btn"
            onClick={undoMisclassification}
            className="ml-auto rounded-md bg-accent px-3 py-1 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            Undo
          </button>
        </div>
      )}
    </>
  );
}
