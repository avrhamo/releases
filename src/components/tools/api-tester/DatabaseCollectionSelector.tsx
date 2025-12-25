import React, { useState, useEffect } from 'react';

interface ConnectionConfig {
  connectionString: string;
  database?: string;
  collection?: string;
  query?: string;
}

interface DatabaseCollectionSelectorProps {
  connectionConfig: ConnectionConfig;
  onSelect: (database: string, collection: string, query?: string) => void;
  onBack?: () => void;
}

export const DatabaseCollectionSelector: React.FC<DatabaseCollectionSelectorProps> = ({
  connectionConfig,
  onSelect,
  onBack
}) => {
  const [databases, setDatabases] = useState<string[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>('');
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  useEffect(() => {
    loadDatabases();
  }, []);

  const loadDatabases = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.listDatabases();
      if (result.success && result.databases) {
        setDatabases(result.databases.map(db => db.name));
      } else {
        setError(result.error || 'Failed to load databases');
      }
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCollections = async (dbName: string) => {
    setIsLoading(true);
    setError(null); 
    try {
      const result = await window.electronAPI.listCollections(dbName);
      if (result.success && result.collections) {
        setCollections(result.collections.map(col => col.name));
      } else {
        setError(result.error || 'Failed to load collections');
      }
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDatabaseSelect = async (dbName: string) => {
    setSelectedDb(dbName);
    setSelectedCollection('');
    if (dbName) {
      await loadCollections(dbName);
    } else {
      setCollections([]);
    }
  };

  const handleCollectionSelect = (collectionName: string) => {
    setSelectedCollection(collectionName);
  };

  const handleContinue = () => {
    if (selectedDb && selectedCollection) {
      if (query) {
        try {
          JSON.parse(query);
          setQueryError(null);
        } catch (e) {
          setQueryError('Invalid JSON query format');
          return;
        }
      }
      onSelect(selectedDb, selectedCollection, query || undefined);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg mb-4">
            <svg className="animate-spin w-8 h-8 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Loading Database Information</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Fetching databases and collections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-lg mb-4 transform transition-all duration-300 hover:scale-105">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
          Select Database & Collection
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Choose your data source and optionally add a query filter
        </p>
      </div>

      {/* Back Button */}
      <div className="flex justify-start">
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 
              text-sm font-medium rounded-xl text-gray-700 dark:text-gray-200 
              bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 
              dark:focus:ring-offset-gray-900 transition-all duration-200 hover:scale-105"
          >
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
        )}
      </div>

      {/* Selection Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Database Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-200 dark:border-gray-700 transition-all duration-300 hover:shadow-2xl">
          <div className="flex items-center space-x-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            </div>
            <div>
              <label 
                htmlFor="database" 
                className="block text-lg font-semibold text-gray-900 dark:text-white"
              >
                Database
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Choose your MongoDB database
              </p>
            </div>
          </div>
          
          <div className="relative group">
            <select
              id="database"
              value={selectedDb}
              onChange={(e) => handleDatabaseSelect(e.target.value)}
              className="
                block w-full px-4 py-3 pr-10 rounded-xl border-2 border-gray-200 dark:border-gray-600
                text-base bg-gray-50 dark:bg-gray-900 dark:text-white
                focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-20 focus:border-blue-500
                transition-all duration-300 group-focus-within:border-blue-400
                appearance-none cursor-pointer
              "
            >
              <option value="">Select a database</option>
              {databases.map(db => (
                <option key={db} value={db}>{db}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Collection Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-200 dark:border-gray-700 transition-all duration-300 hover:shadow-2xl">
          <div className="flex items-center space-x-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <label 
                htmlFor="collection" 
                className="block text-lg font-semibold text-gray-900 dark:text-white"
              >
                Collection
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Choose your data collection
              </p>
            </div>
          </div>
          
          <div className="relative group">
            <select
              id="collection"
              value={selectedCollection}
              onChange={(e) => handleCollectionSelect(e.target.value)}
              disabled={!selectedDb}
              className="
                block w-full px-4 py-3 pr-10 rounded-xl border-2
                text-base transition-all duration-300 appearance-none cursor-pointer
                focus:outline-none focus:ring-4 focus:ring-opacity-20
                disabled:cursor-not-allowed disabled:opacity-50
                ${!selectedDb 
                  ? 'border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-400' 
                  : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 dark:text-white focus:ring-green-500 focus:border-green-500 group-focus-within:border-green-400'
                }
              "
            >
              <option value="">Select a collection</option>
              {collections.map(collection => (
                <option key={collection} value={collection}>{collection}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Query Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-200 dark:border-gray-700 transition-all duration-300 hover:shadow-2xl">
        <div className="flex items-center space-x-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
          </div>
          <div>
            <label 
              htmlFor="query" 
              className="block text-lg font-semibold text-gray-900 dark:text-white"
            >
              Query Filter
              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                (Optional)
              </span>
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              MongoDB query in JSON format to filter documents
            </p>
          </div>
        </div>
        
        <div className="relative group">
          <textarea
            id="query"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setQueryError(null);
            }}
            placeholder='{"status": "active", "category": "example"}'
            className={`
              block w-full px-4 py-3 rounded-xl border-2
              text-sm font-mono bg-gray-50 dark:bg-gray-900
              transition-all duration-300 resize-y min-h-[120px]
              ${queryError 
                ? 'border-red-300 text-red-900 placeholder-red-400 focus:ring-red-500 focus:border-red-500 dark:border-red-600 dark:text-red-200' 
                : 'border-gray-200 dark:border-gray-600 focus:ring-orange-500 focus:border-orange-500 dark:text-white group-focus-within:border-orange-400'
              }
              focus:outline-none focus:ring-4 focus:ring-opacity-20
              placeholder-gray-400 dark:placeholder-gray-500
            `}
          />
        </div>
        
        {queryError && (
          <div className="flex items-start space-x-3 p-4 mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl animate-in slide-in-from-top-2 duration-300">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-red-700 dark:text-red-300 font-medium">
              {queryError}
            </p>
          </div>
        )}
        
        <div className="mt-3 flex items-start space-x-2">
          <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Enter a MongoDB query in JSON format to filter documents. Leave empty to use all documents from the collection.
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">Connection Error</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Continue Button */}
      <div className="flex justify-center">
        <button
          onClick={handleContinue}
          disabled={!selectedDb || !selectedCollection}
          className={`
            group relative inline-flex items-center px-8 py-4 
            text-base font-semibold rounded-2xl shadow-lg
            transition-all duration-300 transform
            ${(!selectedDb || !selectedCollection)
              ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed text-gray-500 dark:text-gray-400'
              : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white hover:scale-105 hover:shadow-xl active:scale-95'
            }
            focus:outline-none focus:ring-4 focus:ring-purple-500 focus:ring-opacity-50
          `}
        >
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <span>Continue to CURL Input</span>
          </div>
        </button>
      </div>
    </div>
  );
};
