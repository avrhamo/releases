import React, { useState } from 'react';

interface MongoDBConnectionFormProps {
  onSubmit: (config: { connectionString: string }) => void;
  defaultConnectionString?: string;
  onBack?: () => void;
}

export const MongoDBConnectionForm: React.FC<MongoDBConnectionFormProps> = ({
  onSubmit,
  defaultConnectionString = 'mongodb://localhost:27017',
  onBack
}) => {
  const [connectionString, setConnectionString] = useState(defaultConnectionString);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsConnecting(true);

    try {
      const result = await window.electronAPI.connectToMongoDB(connectionString);
      if (result.success) {
        onSubmit({ connectionString });
      } else {
        setError(result.error || 'Failed to connect');
      }
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'An unexpected error occurred');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header Section */}
      <div className="text-center mb-8 relative">
        {onBack && (
          <button
            onClick={onBack}
            className="absolute left-0 top-0 inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg mb-4 transform transition-all duration-300 hover:scale-105">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
          Connect to MongoDB
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Enter your MongoDB connection string to get started
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-200 dark:border-gray-700 transition-all duration-300 hover:shadow-2xl">
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-6">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <div>
                <label
                  htmlFor="connectionString"
                  className="block text-lg font-semibold text-gray-900 dark:text-white"
                >
                  Connection String
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Your MongoDB database connection URI
                </p>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl opacity-0 group-focus-within:opacity-10 transition-opacity duration-300"></div>
              <input
                id="connectionString"
                type="text"
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                placeholder="mongodb://username:password@host:port/database"
                className={`
                  relative block w-full px-6 py-4 rounded-xl border-2
                  text-sm font-mono bg-gray-50 dark:bg-gray-900
                  transition-all duration-300
                  ${error
                    ? 'border-red-300 text-red-900 placeholder-red-400 focus:ring-red-500 focus:border-red-500 dark:border-red-600 dark:text-red-200'
                    : 'border-gray-200 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 dark:text-white group-focus-within:border-blue-400'
                  }
                  focus:outline-none focus:ring-4 focus:ring-opacity-20
                  placeholder-gray-400 dark:placeholder-gray-500
                `}
                required
              />
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
            </div>

            {error && (
              <div className="flex items-start space-x-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl animate-in slide-in-from-top-2 duration-300">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                  {error}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center">
          <button
            type="submit"
            disabled={isConnecting || !connectionString.trim()}
            className={`
              group relative inline-flex items-center px-8 py-4 
              text-base font-semibold rounded-2xl shadow-lg
              transition-all duration-300 transform
              ${isConnecting || !connectionString.trim()
                ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed text-gray-500 dark:text-gray-400'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white hover:scale-105 hover:shadow-xl active:scale-95'
              }
              focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50
            `}
          >
            <div className="flex items-center space-x-3">
              {isConnecting ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span>Connect to Database</span>
                </>
              )}
            </div>
          </button>
        </div>
      </form>
    </div>
  );
};