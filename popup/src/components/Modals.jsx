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
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-md p-6 relative">
            <button
              onClick={onCloseMisclassificationModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:text-zinc-400 dark:hover:text-zinc-200 z-10 p-1"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center mb-6">
              <Flag className="mx-auto h-12 w-12 text-red-500 dark:text-red-400 mb-3" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Misclassified Email?
              </h3>
              <p className="text-gray-600 dark:text-zinc-300 text-sm">
                This email was classified as:{' '}
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {selectedEmailForMisclassification?.category || 'N/A'}
                </span>
              </p>
              <p className="text-gray-600 dark:text-zinc-300 text-sm mt-1">
                Subject:{' '}
                <span className="font-semibold">{selectedEmailForMisclassification?.subject || 'N/A'}</span>
              </p>
            </div>

            <div className="mb-6">
              <label
                htmlFor="correctCategory"
                className="block text-sm font-medium text-gray-700 dark:text-zinc-200 mb-2"
              >
                Move to:
              </label>
              <select
                id="correctCategory"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
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
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-zinc-300 bg-gray-200 dark:bg-zinc-700 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  onConfirmMisclassification(selectedEmailForMisclassification, selectedMisclassificationCategory)
                }
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
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
          className="fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white z-50 bg-blue-500 flex items-center space-x-4"
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
            className="ml-auto px-3 py-1 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium transition-colors"
          >
            Undo
          </button>
        </div>
      )}
    </>
  );
}

