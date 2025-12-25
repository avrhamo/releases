import React, { useState, useEffect } from 'react';
import { ChevronLeftIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { CurlAnalyzer } from './components/CurlAnalyzer';

interface ConnectionConfig {
  connectionString: string;
  database?: string;
  collection?: string;
}

interface MappingInfo {
  targetField: string;
  type: 'mongodb' | 'fixed' | 'special';
  value?: string;
  isBase64Encoded?: boolean; // Track if the original field was Base64 encoded
}

interface CurlFieldMapperProps {
  parsedCommand: {
    rawCommand: string;
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    data?: any;
  };
  connectionConfig: ConnectionConfig;
  onMap: (mappedFields: Record<string, MappingInfo>, updatedParsedCommand: {
    rawCommand: string;
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    data?: any;
  }) => void;
  onBack?: () => void;
}

export const CurlFieldMapper: React.FC<CurlFieldMapperProps> = ({
  parsedCommand,
  connectionConfig,
  onMap,
  onBack
}) => {
  const [mappedFields, setMappedFields] = useState<Record<string, MappingInfo>>({});
  const [sampleDocument, setSampleDocument] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [documentFields, setDocumentFields] = useState<string[]>([]);

  useEffect(() => {
    const fetchSampleDocument = async () => {
      setIsLoading(true);
      try {
        const result = await window.electronAPI.findOne(
          connectionConfig.database!,
          connectionConfig.collection!
        );
        
        if (result.success) {
          setSampleDocument(result.document);
          const fields = extractDocumentFields(result.document);
          setDocumentFields(fields);
        } else {
          setError(result.error || 'Failed to fetch sample document');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    if (connectionConfig.database && connectionConfig.collection) {
      fetchSampleDocument();
    }
  }, [connectionConfig.database, connectionConfig.collection]);

  const extractDocumentFields = (doc: any, prefix = ''): string[] => {
    if (!doc) return [];
    
    return Object.entries(doc).flatMap(([key, value]) => {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return extractDocumentFields(value, fullPath);
      }
      return [fullPath];
    });
  };

  const handleFieldMap = (field: string, mappingInfo: MappingInfo) => {
    setMappedFields(prev => ({
      ...prev,
      [field]: mappingInfo,
    }));
  };

  const handleSubmit = () => {
    onMap(mappedFields, parsedCommand);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg mb-4">
            <svg className="animate-spin w-8 h-8 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Loading Sample Data</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Fetching document structure...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex-none mb-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg mb-4 transform transition-all duration-300 hover:scale-105">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            Map Fields
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Connect your CURL command fields with MongoDB document fields
          </p>
        </div>

        {/* Back Button */}
        <div className="flex justify-start mt-6">
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 
                text-sm font-medium rounded-xl text-gray-700 dark:text-gray-200 
                bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 
                dark:focus:ring-offset-gray-900 transition-all duration-200 hover:scale-105"
            >
              <ChevronLeftIcon className="w-4 h-4 mr-2" />
              Back
            </button>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full">
          {/* CURL Analysis Section - Takes 2 columns */}
          <div className="xl:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 hover:shadow-2xl">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    CURL Command Analysis
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Click on any field to map it to your MongoDB data
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <CurlAnalyzer
                curlCommand={parsedCommand.rawCommand}
                onFieldMap={handleFieldMap}
                availableFields={documentFields}
                requestData={parsedCommand.data}
              />
            </div>
          </div>

          {/* Sample Document Preview - Takes 1 column */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 hover:shadow-2xl">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Sample Document
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Your MongoDB collection structure
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono leading-relaxed">
                  {JSON.stringify(sampleDocument, null, 2)}
                </pre>
              </div>
              
              <div className="mt-4 flex items-start space-x-2">
                <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  This is a sample document from your collection showing the available fields for mapping.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Footer */}
      <div className="flex-none pt-6">
        <div className="flex justify-center">
          <button 
            onClick={handleSubmit}
            className="
              group relative inline-flex items-center px-8 py-4 
              text-base font-semibold rounded-2xl shadow-lg
              transition-all duration-300 transform
              bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 
              text-white hover:scale-105 hover:shadow-xl active:scale-95
              focus:outline-none focus:ring-4 focus:ring-emerald-500 focus:ring-opacity-50
            "
          >
            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span>Start Testing</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}; 