/**
 * @file CompanyField.jsx
 * @description Inline editable field for company name or position with visual indicators for auto-extracted vs user-corrected values.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { cn } from '../utils/cn';

const CompanyField = ({ email, userEmail, onUpdate, fieldName = 'company' }) => {
  // Determine which field we're editing
  const fieldKey = fieldName === 'position' ? 'position' : 'company_name';
  const correctedKey = fieldName === 'position' ? 'position_corrected' : 'company_name_corrected';
  const placeholder = fieldName === 'position' ? 'Position' : 'Company';
  
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(email?.[fieldKey] || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const fieldValue = email?.[fieldKey] || `Unknown ${placeholder}`;
  const isCorrected = email?.[correctedKey] === true;
  const extractionMethod = email?.extraction_method || 'rules';

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleEdit = (e) => {
    e.stopPropagation();
    setInputValue(email?.[fieldKey] || '');
    setIsEditing(true);
    setError(null);
  };

  const handleCancel = (e) => {
    e.stopPropagation();
    setIsEditing(false);
    setInputValue(email?.[fieldKey] || '');
    setError(null);
  };

  const handleSave = async (e) => {
    e.stopPropagation();
    
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) {
      setError(`${placeholder} cannot be empty`);
      return;
    }

    if (trimmedValue === email?.[fieldKey]) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = await onUpdate(email.id, trimmedValue);
      if (result.success) {
        setIsEditing(false);
      } else {
        setError(result.error || `Failed to update ${placeholder.toLowerCase()}`);
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave(e);
    } else if (e.key === 'Escape') {
      handleCancel(e);
    }
  };

  if (!email) return null;

  return (
    <div className="flex items-center space-x-2 text-sm">      
      {isEditing ? (
        <div className="flex items-center space-x-2 flex-1" onClick={(e) => e.stopPropagation()}>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            maxLength={100}
            placeholder={`Enter ${placeholder.toLowerCase()}...`}
            className={cn(
              "flex-1 px-3 py-2 text-sm border rounded-md",
              "focus:outline-none focus:ring-2 focus:ring-blue-500",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              error ? "border-red-500" : "border-gray-300 dark:border-zinc-600",
              "bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
            )}
          />
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              "p-2 rounded-md hover:bg-green-100 dark:hover:bg-green-900/20 text-green-600",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            title="Save"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className={cn(
              "p-2 rounded-md hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between flex-1 min-w-0">
          <span className="text-sm text-gray-900 dark:text-white truncate">{fieldValue}</span>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleEdit}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500 hover:text-blue-600 flex-shrink-0"
              title={`Edit ${placeholder.toLowerCase()}`}
            >
              <Pencil className="h-4 w-4" />
            </button>
            {isCorrected && (
              <span
                className="inline-flex items-center px-2 py-1 rounded text-[10px] bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 flex-shrink-0"
                title={`Corrected by user (was auto-extracted by ${extractionMethod})`}
              >
                ✓ User
              </span>
            )}
            {!isCorrected && extractionMethod && (
              <span
                className="inline-flex items-center px-2 py-1 rounded text-[10px] bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-zinc-400 flex-shrink-0"
                title={`Auto-extracted by ${extractionMethod}`}
              >
                Auto
              </span>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-600 dark:text-red-400 mt-1">
          {error}
        </div>
      )}
    </div>
  );
};

export default CompanyField;
