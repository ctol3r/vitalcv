'use client';

/**
 * NCQA Multi-Provider Audit Export UI
 * B133A-FE-009: Multi-select provider list, progress bar, final ZIP link
 */

import { useEffect, useState } from 'react';

interface Provider {
  id: string;
  name: string;
  email: string;
  npi?: string;
  credentialCount: number;
}

interface ExportProgress {
  status: 'idle' | 'loading' | 'generating' | 'complete' | 'error';
  current: number;
  total: number;
  message: string;
}

export default function MultiProviderAuditExportPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<ExportProgress>({
    status: 'idle',
    current: 0,
    total: 0,
    message: '',
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch providers list
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        // Mock data for now - replace with actual API call
        // const response = await fetch('/api/providers');
        // const data = await response.json();

        // Simulated provider data
        const mockProviders: Provider[] = [
          { id: '1', name: 'Dr. Jane Smith', email: 'jane.smith@example.com', npi: '1234567890', credentialCount: 5 },
          { id: '2', name: 'Dr. John Doe', email: 'john.doe@example.com', npi: '0987654321', credentialCount: 3 },
          { id: '3', name: 'Dr. Alice Johnson', email: 'alice.j@example.com', npi: '1122334455', credentialCount: 7 },
          { id: '4', name: 'Dr. Bob Wilson', email: 'bob.w@example.com', npi: '5544332211', credentialCount: 4 },
          { id: '5', name: 'Dr. Carol Martinez', email: 'carol.m@example.com', npi: '6677889900', credentialCount: 6 },
        ];

        setProviders(mockProviders);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch providers:', error);
        setLoading(false);
      }
    };

    fetchProviders();
  }, []);

  // Toggle provider selection
  const toggleProvider = (providerId: string) => {
    const newSelected = new Set(selectedProviders);
    if (newSelected.has(providerId)) {
      newSelected.delete(providerId);
    } else {
      newSelected.add(providerId);
    }
    setSelectedProviders(newSelected);
  };

  // Select all filtered providers
  const selectAll = () => {
    const filtered = getFilteredProviders();
    const newSelected = new Set(selectedProviders);
    filtered.forEach(p => newSelected.add(p.id));
    setSelectedProviders(newSelected);
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedProviders(new Set());
  };

  // Filter providers by search query
  const getFilteredProviders = () => {
    if (!searchQuery) return providers;

    const query = searchQuery.toLowerCase();
    return providers.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.email.toLowerCase().includes(query) ||
      (p.npi && p.npi.includes(query))
    );
  };

  // Handle export
  const handleExport = async () => {
    if (selectedProviders.size === 0) {
      alert('Please select at least one provider');
      return;
    }

    setProgress({
      status: 'generating',
      current: 0,
      total: selectedProviders.size,
      message: 'Preparing export...',
    });

    try {
      const providerIds = Array.from(selectedProviders);

      // Call export API
      const response = await fetch('/api/audit/export-many', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerIds,
          requestedBy: 'current-user-id', // Replace with actual user ID
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Download the ZIP file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ncqa-audit-export-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setProgress({
        status: 'complete',
        current: selectedProviders.size,
        total: selectedProviders.size,
        message: 'Export complete! Download started.',
      });

      // Reset after 3 seconds
      setTimeout(() => {
        setProgress({
          status: 'idle',
          current: 0,
          total: 0,
          message: '',
        });
      }, 3000);

    } catch (error: any) {
      console.error('Export failed:', error);
      setProgress({
        status: 'error',
        current: 0,
        total: 0,
        message: error.message || 'Export failed',
      });
    }
  };

  // Keyboard navigation support
  const handleKeyDown = (e: React.KeyboardEvent, providerId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleProvider(providerId);
    }
  };

  const filteredProviders = getFilteredProviders();
  const selectedCount = selectedProviders.size;
  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading providers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">NCQA Audit Export</h1>
          <p className="text-gray-600">
            Select multiple providers to generate evidence bundle ZIP files
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <label htmlFor="search" className="sr-only">Search providers</label>
              <input
                id="search"
                type="text"
                placeholder="Search by name, email, or NPI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-label="Search providers"
              />
            </div>
            <button
              onClick={selectAll}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium"
              disabled={progress.status === 'generating'}
            >
              Select All
            </button>
            <button
              onClick={deselectAll}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              disabled={progress.status === 'generating'}
            >
              Clear
            </button>
          </div>

          <div className="text-sm text-gray-600">
            <strong>{selectedCount}</strong> provider{selectedCount !== 1 ? 's' : ''} selected •{' '}
            <strong>{filteredProviders.length}</strong> total providers
          </div>
        </div>

        {/* Provider List */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-6">
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {filteredProviders.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                No providers found matching your search
              </div>
            ) : (
              filteredProviders.map((provider) => {
                const isSelected = selectedProviders.has(provider.id);

                return (
                  <div
                    key={provider.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => toggleProvider(provider.id)}
                    onKeyDown={(e) => handleKeyDown(e, provider.id)}
                    role="checkbox"
                    aria-checked={isSelected}
                    tabIndex={0}
                  >
                    <div className="flex items-center gap-4">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Handled by parent div
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        tabIndex={-1}
                        aria-hidden="true"
                      />

                      {/* Provider Info */}
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{provider.name}</div>
                        <div className="text-sm text-gray-600">
                          {provider.email}
                          {provider.npi && (
                            <span className="ml-2">• NPI: {provider.npi}</span>
                          )}
                        </div>
                      </div>

                      {/* Credential Count */}
                      <div className="text-sm text-gray-500">
                        {provider.credentialCount} credential{provider.credentialCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Export Button and Progress */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          {progress.status === 'idle' && (
            <button
              onClick={handleExport}
              disabled={selectedCount === 0}
              className={`w-full py-3 rounded-lg font-semibold text-white ${
                selectedCount === 0
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
              aria-label={`Export ${selectedCount} provider${selectedCount !== 1 ? 's' : ''}`}
            >
              Export {selectedCount} Provider{selectedCount !== 1 ? 's' : ''}
            </button>
          )}

          {progress.status === 'generating' && (
            <div>
              <div className="mb-3 flex justify-between text-sm text-gray-600">
                <span>{progress.message}</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <div className="relative pt-1">
                <div className="overflow-hidden h-4 text-xs flex rounded bg-gray-200">
                  <div
                    style={{ width: `${progressPercent}%` }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-600 transition-all duration-300"
                    role="progressbar"
                    aria-valuenow={progressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              </div>
            </div>
          )}

          {progress.status === 'complete' && (
            <div className="text-center py-3">
              <div className="text-green-600 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-semibold text-green-800">{progress.message}</p>
            </div>
          )}

          {progress.status === 'error' && (
            <div className="text-center py-3">
              <div className="text-red-600 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="font-semibold text-red-800">{progress.message}</p>
              <button
                onClick={handleExport}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Export Information</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Each provider will have their own ZIP file containing credentials and evidence</li>
            <li>• All provider ZIPs will be bundled into one master ZIP file</li>
            <li>• Export includes provider metadata, active credentials, and NPI claims</li>
            <li>• Keyboard navigation: Use Tab to navigate, Enter/Space to select</li>
            <li>• Large exports may take several minutes to complete</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

