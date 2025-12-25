import React, { useState, useEffect } from 'react';
import { useTheme } from '../../../hooks/useTheme';
import {
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ServerIcon,
  CommandLineIcon
} from '@heroicons/react/24/outline';

interface ProcessInfo {
  pid: number;
  name: string;
  command: string;
  user: string;
}

declare global {
  interface Window {
    electronAPI: {
      killPort: (port: number) => Promise<{
        success: boolean;
        message?: string;
        error?: string;
        pids?: number[];
      }>;
      checkPort?: (port: number) => Promise<{
        inUse: boolean;
        processes?: ProcessInfo[];
        error?: string;
      }>;
    };
  }
}

const PortKiller: React.FC = () => {
  const { theme } = useTheme();
  const [port, setPort] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(theme);

  // Subscribe to theme changes
  useEffect(() => {
    setCurrentTheme(theme);
  }, [theme]);

  const checkPort = async () => {
    if (!port.match(/^\d+$/)) {
      setError('Please enter a valid port number.');
      return;
    }

    const portNumber = parseInt(port, 10);
    if (portNumber < 1 || portNumber > 65535) {
      setError('Port number must be between 1 and 65535.');
      return;
    }

    setError(null);
    setResult(null);
    setChecking(true);
    setProcesses([]);

    try {
      // Check if we have the checkPort API
      if (window.electronAPI.checkPort) {
        const response = await window.electronAPI.checkPort(portNumber);
        
        if (response.error) {
          setError(response.error);
        } else if (!response.inUse) {
          setResult(`Port ${port} is not in use.`);
        } else if (response.processes && response.processes.length > 0) {
          setProcesses(response.processes);
          setShowConfirmation(true);
        } else {
          // Fallback if no process details
          setShowConfirmation(true);
        }
      } else {
        // Fallback if API doesn't exist
        setShowConfirmation(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setChecking(false);
    }
  };

  const handleKill = async () => {
    setResult(null);
    setError(null);
    setLoading(true);
    setShowConfirmation(false);

    try {
      const portNumber = parseInt(port, 10);
      const response = await window.electronAPI.killPort(portNumber);
      
      if (response.success) {
        setResult(response.message || `Successfully killed process(es) on port ${port}`);
        setProcesses([]);
      } else {
        setError(response.error || 'Failed to kill process on port');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const cancelKill = () => {
    setShowConfirmation(false);
    setProcesses([]);
  };

  return (
    <div className="max-w-4xl mx-auto p-8 h-full flex flex-col space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4 flex items-center justify-center">
          <ExclamationTriangleIcon className="w-10 h-10 mr-4 text-red-600" />
          Port Killer
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Find and terminate processes using specific ports. Perfect for developers dealing with "port already in use" errors.
        </p>
      </div>

      {/* Main Input Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Port Number
            </label>
            <div className="relative">
              <input
                type="text"
                value={port}
                onChange={e => setPort(e.target.value)}
                placeholder="Enter port number (e.g., 3000, 8080, 5173)"
                className="w-full px-6 py-4 text-2xl border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
                onKeyPress={(e) => e.key === 'Enter' && !checking && !loading && port && checkPort()}
              />
              <ServerIcon className="absolute right-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-gray-400" />
            </div>
          </div>
          
          <div className="flex space-x-4">
            <button
              onClick={checkPort}
              disabled={checking || !port}
              className={`flex-1 px-8 py-4 rounded-xl text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
                checking || !port
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
              }`}
            >
              <div className="flex items-center justify-center">
                <MagnifyingGlassIcon className="w-6 h-6 mr-3" />
                {checking ? 'Checking Port...' : 'Check Port'}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Process Information & Confirmation */}
      {showConfirmation && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-2xl p-8">
          <div className="text-center mb-6">
            <ExclamationTriangleIcon className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-red-800 dark:text-red-300 mb-2">
              Confirm Process Termination
            </h3>
            <p className="text-red-700 dark:text-red-400">
              The following process(es) will be forcefully terminated:
            </p>
          </div>

          {processes.length > 0 ? (
            <div className="space-y-4 mb-8">
              {processes.map((process, index) => (
                <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-red-200 dark:border-red-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <CommandLineIcon className="w-8 h-8 text-gray-600 dark:text-gray-400" />
                      <div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-white">
                          {process.name || 'Unknown Process'}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          PID: {process.pid} | User: {process.user || 'Unknown'}
                        </div>
                        {process.command && (
                          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 font-mono">
                            {process.command.length > 60 ? `${process.command.substring(0, 60)}...` : process.command}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-red-600 dark:text-red-400">
                        Port {port}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-red-200 dark:border-red-700 mb-8 text-center">
              <div className="text-lg text-gray-600 dark:text-gray-400">
                Process using port {port} (details unavailable)
              </div>
            </div>
          )}

          <div className="flex space-x-4">
            <button
              onClick={cancelKill}
              className="flex-1 px-8 py-4 rounded-xl text-lg font-semibold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleKill}
              disabled={loading}
              className={`flex-1 px-8 py-4 rounded-xl text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 transition-all duration-200 ${
                loading
                  ? 'bg-red-400 cursor-not-allowed text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl'
              }`}
            >
              <div className="flex items-center justify-center">
                <TrashIcon className="w-6 h-6 mr-3" />
                {loading ? 'Terminating...' : 'Terminate Process'}
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-2xl p-6">
          <div className="flex items-center">
            <CheckCircleIcon className="w-8 h-8 text-green-600 mr-4" />
            <div>
              <h4 className="text-lg font-semibold text-green-800 dark:text-green-300">Success!</h4>
              <p className="text-green-700 dark:text-green-400">{result}</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-2xl p-6">
          <div className="flex items-center">
            <XCircleIcon className="w-8 h-8 text-red-600 mr-4" />
            <div>
              <h4 className="text-lg font-semibold text-red-800 dark:text-red-300">Error</h4>
              <p className="text-red-700 dark:text-red-400">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Developer Tips */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-700">
        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-3">
          💡 Developer Tips
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700 dark:text-blue-300">
          <div>
            <strong>Common Ports:</strong> 3000 (React), 8080 (Spring Boot), 5173 (Vite), 4200 (Angular)
          </div>
          <div>
            <strong>Alternative:</strong> Use `kill -9 $(lsof -ti:PORT)` in terminal
          </div>
          <div>
            <strong>Prevention:</strong> Always stop dev servers properly with Ctrl+C
          </div>
          <div>
            <strong>Safety:</strong> Double-check process details before terminating
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortKiller; 