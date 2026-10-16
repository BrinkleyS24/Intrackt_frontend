/**
 * @file popup/src/components/Modals.jsx
 * @description Renders application modals (misclassification + undo toast).
 */

import React, { useEffect, useState } from 'react';
import { X, Flag } from 'lucide-react';
import {
  MISCLASSIFY_CHOICES,
  canSubmitMisclassify,
  currentMisclassifyStage,
  misclassifyStageLabel,
} from '../utils/misclassify.mjs';

export default function Modals({
  isMisclassificationModalOpen,
  onCloseMisclassificationModal,
  selectedEmailForMisclassification,
  onConfirmMisclassification,
  undoToastVisible,
  setUndoToastVisible,
  undoMisclassification,
}) {
  // Starts on the email's current stage and saves nothing until the user picks another one. It used
  // to preselect "Irrelevant", so one click hid a real interview email (persona report 2026-10-15).
  const currentStage = currentMisclassifyStage(selectedEmailForMisclassification);
  const [selectedMisclassificationCategory, setSelectedMisclassificationCategory] = useState(currentStage || '');
  useEffect(() => {
    if (isMisclassificationModalOpen) setSelectedMisclassificationCategory(currentStage || '');
  }, [isMisclassificationModalOpen, currentStage, selectedEmailForMisclassification?.id]);
  const canSubmit = canSubmitMisclassify(currentStage, selectedMisclassificationCategory);

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
          role="dialog"
          aria-modal="true"
          aria-labelledby="misclassify-title"
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

            <div className="mb-5 text-center">
              <Flag className="mx-auto mb-3 h-10 w-10 text-destructive" />
              <h2 id="misclassify-title" className="mb-2 text-lg font-semibold text-foreground">
                Wrong stage for this email?
              </h2>
              <p className="text-sm text-muted-foreground">
                Filed now as:{' '}
                <span data-testid="misclassify-current-stage" className="font-bold text-accent-text">
                  {currentStage ? misclassifyStageLabel(currentStage) : 'Unknown'}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Subject:{' '}
                <span className="font-semibold text-foreground">{selectedEmailForMisclassification?.subject || 'No subject'}</span>
              </p>
            </div>

            <div className="mb-5">
              <label
                htmlFor="correctCategory"
                className="mb-2 block text-sm font-medium text-secondary-foreground"
              >
                What does this email say happened?
              </label>
              <select
                id="correctCategory"
                data-testid="misclassify-stage-select"
                className="mt-1 block w-full rounded-md border border-border bg-popover py-2 pl-3 pr-10 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                value={selectedMisclassificationCategory}
                onChange={(e) => setSelectedMisclassificationCategory(e.target.value)}
              >
                {!currentStage ? <option value="" disabled>Choose a stage</option> : null}
                {MISCLASSIFY_CHOICES.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.value === currentStage ? `${choice.label} (current)` : choice.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm text-muted-foreground">
                Pick the stage this one email describes, even if the application has moved on since.
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={onCloseMisclassificationModal}
                className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  onConfirmMisclassification(selectedEmailForMisclassification, selectedMisclassificationCategory)
                }
                disabled={!canSubmit}
                data-testid="misclassify-submit"
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
              >
                Save correction
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
          <span>Correction saved.</span>
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
