import React, { useState } from 'react';
import { Search, X, SlidersHorizontal, Calendar } from 'lucide-react';

export default function CategorySearchFilter({ 
  category, 
  emails, 
  onFilteredResults,
  totalEmails 
}) {
  const [searchText, setSearchText] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filters, setFilters] = useState({
    searchFields: 'all',
    status: 'all',
    dateFrom: '',
    dateTo: '',
    sortBy: 'date',
    sortOrder: 'desc'
  });

  const applyFilters = () => {
    let filtered = [...emails];

    if (searchText.trim()) {
      const query = searchText.toLowerCase();
      filtered = filtered.filter(email => {
        if (filters.searchFields === 'all') {
          return (
            email.subject?.toLowerCase().includes(query) ||
            email.company_name?.toLowerCase().includes(query) ||
            email.position?.toLowerCase().includes(query) ||
            email.from?.toLowerCase().includes(query)
          );
        } else if (filters.searchFields === 'subject') {
          return email.subject?.toLowerCase().includes(query);
        } else if (filters.searchFields === 'company') {
          return email.company_name?.toLowerCase().includes(query);
        } else if (filters.searchFields === 'position') {
          return email.position?.toLowerCase().includes(query);
        }
        return true;
      });
    }

    if (filters.status === 'unread') {
      filtered = filtered.filter(email => !email.is_read);
    } else if (filters.status === 'read') {
      filtered = filtered.filter(email => email.is_read);
    } else if (filters.status === 'starred') {
      filtered = filtered.filter(email => email.is_starred);
    }

    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(email => new Date(email.date) >= fromDate);
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(email => new Date(email.date) <= toDate);
    }

    filtered.sort((a, b) => {
      let aVal, bVal;
      if (filters.sortBy === 'date') {
        aVal = new Date(a.date);
        bVal = new Date(b.date);
      } else if (filters.sortBy === 'company') {
        aVal = a.company_name?.toLowerCase() || '';
        bVal = b.company_name?.toLowerCase() || '';
      } else if (filters.sortBy === 'subject') {
        aVal = a.subject?.toLowerCase() || '';
        bVal = b.subject?.toLowerCase() || '';
      }

      if (filters.sortOrder === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });

    onFilteredResults(filtered, { searchText, ...filters });
  };

  const clearFilters = () => {
    setSearchText('');
    setFilters({
      searchFields: 'all',
      status: 'all',
      dateFrom: '',
      dateTo: '',
      sortBy: 'date',
      sortOrder: 'desc'
    });
    onFilteredResults(emails, {});
  };

  const hasActiveFilters = searchText || filters.status !== 'all' || filters.dateFrom || filters.dateTo;

  return (
    <div className="p-4 border-b bg-gray-50">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
          placeholder="Search emails..."
          className="w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        {searchText && (
          <button 
            onClick={() => { setSearchText(''); clearFilters(); }} 
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        <SlidersHorizontal className="w-4 h-4" />
        <span>{showAdvanced ? 'Hide' : 'Show'} Advanced Search</span>
      </button>

      {showAdvanced && (
        <div className="mt-4 p-4 bg-white border rounded-lg space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search in</label>
              <select
                value={filters.searchFields}
                onChange={(e) => setFilters({ ...filters, searchFields: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All fields</option>
                <option value="subject">Subject</option>
                <option value="company">Company</option>
                <option value="position">Position</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All emails</option>
                <option value="unread">Unread only</option>
                <option value="read">Read only</option>
                <option value="starred">Starred only</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              <Calendar className="inline w-4 h-4 mr-1" />
              Date Range
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort by</label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="date">Date</option>
                <option value="company">Company</option>
                <option value="subject">Subject</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
              <select
                value={filters.sortOrder}
                onChange={(e) => setFilters({ ...filters, sortOrder: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={applyFilters}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Apply Filters
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {hasActiveFilters && (
        <div className="mt-3 text-sm text-gray-600">
          Showing filtered results  <button onClick={clearFilters} className="text-blue-600 hover:underline">Clear all filters</button>
        </div>
      )}
    </div>
  );
}
