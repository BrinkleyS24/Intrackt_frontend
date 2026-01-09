import React, { useState, useEffect } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { sendMessageToBackground } from '../utils/chromeMessaging';

/**
 * Cross-category application lifecycle search.
 */
export default function SearchBar({ onEmailSelect }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length === 0) {
      setSearchResults(null);
      setError(null);
      return;
    }
    const debounceTimer = setTimeout(() => performSearch(searchQuery), 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const performSearch = async (query) => {
    setIsSearching(true);
    setError(null);
    try {
      // Send search request to background script which handles authentication
      const response = await sendMessageToBackground({ 
        type: 'SEARCH_EMAILS',
        query: query
      });
      
      if (response.success) {
        setSearchResults(response);
      } else {
        throw new Error(response.error || 'Search failed');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="sticky top-0 z-10 bg-white border-b p-4">
      <div className="flex items-center gap-2 mb-3">
        <SlidersHorizontal className="w-4 h-4 text-purple-600" />
        <span className="text-sm font-semibold text-gray-700">Search</span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search across all categories..."
          className="w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {isSearching && <div className="text-center mt-2 text-gray-500">Searching...</div>}
      {error && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {searchResults && searchResults.applications && (
        <div className="max-h-96 overflow-y-auto mt-2 border rounded-lg">
          {searchResults.applications.map((app, idx) => (
            <div key={idx} className="border-b last:border-b-0">
              <div className="p-3 bg-gray-50">
                <div className="font-medium text-gray-900">{app.company} - {app.position}</div>
                <div className="text-sm text-gray-600 mt-1">
                  {app.latestStatus} | {app.emailCount} email{app.emailCount !== 1 ? 's' : ''}
                </div>
              </div>
              {app.emails.map((email) => (
                <button
                  key={email.id}
                  onClick={() => { 
                    // Pass the grouped emails so the preview can show the full thread
                    onEmailSelect(email, { emails: app.emails }); 
                    setSearchQuery(''); 
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 border-t">
                  <div className="text-sm text-gray-900 truncate">{email.subject}</div>
                  <div className="text-xs text-gray-500 mt-1">{email.category}</div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {searchResults && searchResults.applications && searchResults.applications.length === 0 && (
        <div className="text-center mt-4 text-gray-500">
          <p>No results found for "{searchQuery}"</p>
        </div>
      )}
    </div>
  );
}
