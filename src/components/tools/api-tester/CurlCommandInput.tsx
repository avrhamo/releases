import React, { useState } from 'react';
import MonacoEditor from '../../common/editor/MonacoEditor';
import { useTheme } from '../../../hooks/useTheme';
import { parseCurl } from './utils';

interface CurlCommandInputProps {
  initialCommand?: string;
  onCommandChange: (parsedCommand: {
    rawCommand: string;
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    data?: any;
  }) => void;
  onBack?: () => void;
  availableFields?: string[];
}

export const CurlCommandInput: React.FC<CurlCommandInputProps> = ({
  initialCommand = '',
  onCommandChange,
  onBack,
  availableFields = [] // Provide default empty array
}) => {
  const [curlCommand, setCurlCommand] = useState(initialCommand);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  const editorTheme = theme === 'dark' ? 'vs-dark' : 'light';

  const handleCurlChange = (value: string | undefined) => {
    setCurlCommand(value || '');
    setError(null);
  };

  const isValidCurlCommand = (cmd: string | undefined): boolean => {
    if (!cmd) return false;
    const trimmedCmd = cmd.trim().toLowerCase();
    return trimmedCmd.startsWith('curl') && trimmedCmd.length > 5;
  };

  const handleSubmit = () => {
    try {
      if (curlCommand && curlCommand.trim()) {
        const parsed = parseCurl(curlCommand);
        
        // Ensure we have a valid JSON body for POST/PUT/PATCH requests
        if (['POST', 'PUT', 'PATCH'].includes(parsed.method) && !parsed.body) {
          throw new Error('Request body is required for ' + parsed.method + ' requests');
        }

        // Validate that the body is a proper object for JSON requests
        if (parsed.headers['Content-Type']?.toLowerCase().includes('application/json')) {
          if (typeof parsed.body === 'string') {
            try {
              const jsonBody = JSON.parse(parsed.body);
              onCommandChange({
                rawCommand: curlCommand,
                method: parsed.method,
                url: parsed.url,
                headers: parsed.headers,
                data: jsonBody
              });
            } catch (err) {
              throw new Error('Invalid JSON in request body: ' + (err instanceof Error ? err.message : String(err)));
            }
          } else {
            onCommandChange({
              rawCommand: curlCommand,
              method: parsed.method,
              url: parsed.url,
              headers: parsed.headers,
              data: parsed.body
            });
          }
        } else {
          onCommandChange({
            rawCommand: curlCommand,
            method: parsed.method,
            url: parsed.url,
            headers: parsed.headers,
            data: parsed.body
          });
        }
      } else {
        setError('Please enter a valid CURL command');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CURL command');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg mb-4 transform transition-all duration-300 hover:scale-105">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
          Enter CURL Command
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Paste your CURL command to configure the API test
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

      {/* Editor Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 hover:shadow-2xl">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                CURL Command
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Paste or type your complete CURL command
              </p>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="h-64 bg-gray-50 dark:bg-gray-900">
            <MonacoEditor
              value={curlCommand}
              onChange={handleCurlChange}
              language="shell"
              theme={editorTheme}
              height={256}
            />
          </div>
          
          {/* Editor Overlay Indicators */}
          <div className="absolute top-3 right-3 flex items-center space-x-2">
            {isValidCurlCommand(curlCommand) ? (
              <div className="flex items-center space-x-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-xs font-medium">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Valid
              </div>
            ) : curlCommand.trim() ? (
              <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-lg text-xs font-medium">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Invalid
              </div>
            ) : null}
          </div>
        </div>

        {error && (
          <div className="p-6 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-red-800 dark:text-red-200">Parsing Error</h4>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-start space-x-2">
            <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <p className="font-medium mb-1">Example:</p>
              <code className="block bg-white dark:bg-gray-800 px-2 py-1 rounded text-gray-800 dark:text-gray-200 font-mono">
                curl -X POST 'https://api.example.com/users' -H 'Content-Type: application/json' -d '{"{"}...{"}"}'
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Continue Button */}
      <div className="flex justify-center">
        <button
          onClick={handleSubmit}
          disabled={!isValidCurlCommand(curlCommand)}
          className={`
            group relative inline-flex items-center px-8 py-4 
            text-base font-semibold rounded-2xl shadow-lg
            transition-all duration-300 transform
            ${!isValidCurlCommand(curlCommand)
              ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed text-gray-500 dark:text-gray-400'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white hover:scale-105 hover:shadow-xl active:scale-95'
            }
            focus:outline-none focus:ring-4 focus:ring-indigo-500 focus:ring-opacity-50
          `}
        >
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <span>Continue to Field Mapping</span>
          </div>
        </button>
      </div>
    </div>
  );
};