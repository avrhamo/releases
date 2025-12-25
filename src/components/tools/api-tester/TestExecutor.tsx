import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronLeftIcon, PlayIcon, StopIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

declare global {
  interface Window {
    electronAPI: {
      executeRequest: (config: any) => Promise<{ 
        success: boolean; 
        status?: number;
        statusText?: string;
        body?: string;
        headers?: Record<string, string>;
        duration?: number; 
        error?: string; 
      }>;
      executeRequests: (configs: any[]) => Promise<Array<{ 
        success: boolean; 
        status?: number;
        statusText?: string;
        body?: string;
        headers?: Record<string, string>;
        duration: number; 
        error?: string; 
      }>>;
      findOne: (database: string, collection: string) => Promise<{ success: boolean; document?: any; error?: string }>;
      mongodb: {
        initializeBatch: (config: { 
          database: string; 
          collection: string; 
          query?: any; 
          batchSize?: number; 
        }) => Promise<{ success: boolean; batchId?: string; error?: string }>;
        getNextDocument: (batchId: string) => Promise<{ success: boolean; document?: any; error?: string }>;
        closeBatch: (batchId: string) => Promise<{ success: boolean; error?: string }>;
      }
    }
  }
}

interface ConnectionConfig {
  connectionString: string;
  database?: string;
  collection?: string;
  query?: any;
}

interface MappedFieldConfig {
  targetField: string;
  type: string;
  isBase64Encoded?: boolean; // Track if the original field was Base64 encoded
}

interface CurlConfig {
  parsedCommand: {
    rawCommand: string;
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    data?: any;
  };
  mappedFields: Record<string, MappedFieldConfig>;
}

interface TestConfig {
  url: string;
  method: string;
  headers: Record<string, string>;
  data?: any;
  numberOfRequests: number;
  concurrent: boolean;
  requestsPerSecond: number;
  delayBetweenRequests: number; // in milliseconds
  timeout: number;
  mappedFields?: Record<string, string>;
  connectionConfig?: {
    database: string;
    collection: string;
    query?: string;
    connectionString: string;
  };
}

interface TestExecutorProps {
  connectionConfig: ConnectionConfig;
  curlConfig: CurlConfig;
  testConfig: TestConfig;
  onConfigChange: (config: TestConfig) => void;
  onConnectionConfigChange: (config: ConnectionConfig) => void;
  onCurlConfigChange: (config: CurlConfig) => void;
  onBack: () => void;
}

interface TestResult {
  success: boolean;
  duration: number;
  statusCode?: number;
  error?: string;
  response?: any;
  headers?: Record<string, string>;
  traceInfo?: {
    spanId?: string;
    sessionId?: string;
    traceId?: string;
    requestId?: string;
    correlationId?: string;
  };
}


interface TestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  currentThroughput: number;
  errorRate: number;
  isRunning: boolean;
  startTime?: Date;
}

export const TestExecutor: React.FC<TestExecutorProps> = ({
  connectionConfig,
  curlConfig,
  testConfig: initialTestConfig,
  onConfigChange,
  onBack
}) => {
  // Ensure we have a complete testConfig with defaults
  const testConfig = {
    ...initialTestConfig,
    numberOfRequests: initialTestConfig?.numberOfRequests ?? 100,
    concurrent: initialTestConfig?.concurrent ?? true,
    requestsPerSecond: initialTestConfig?.requestsPerSecond ?? 10,
    delayBetweenRequests: initialTestConfig?.delayBetweenRequests ?? 100, // 100ms default delay
    timeout: initialTestConfig?.timeout ?? 30000
  };

  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [metrics, setMetrics] = useState<TestMetrics>({
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    minResponseTime: 0,
    maxResponseTime: 0,
    currentThroughput: 0,
    errorRate: 0,
    isRunning: false
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [showTraceModal, setShowTraceModal] = useState(false);
  const [selectedStatusGroup, setSelectedStatusGroup] = useState<string>('');
  const cancelTokenRef = useRef<boolean>(false);
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleConfigChange = useCallback((key: keyof TestConfig, value: any) => {
    const newConfig = {
      ...testConfig,
      [key]: value
    };
    onConfigChange(newConfig);
  }, [testConfig, onConfigChange]);

  const updateMetrics = useCallback((newResults: TestResult[]) => {
    const successful = newResults.filter(r => r.success);
    const failed = newResults.filter(r => !r.success);
    const durations = successful.map(r => r.duration);
    
    const newMetrics: TestMetrics = {
      totalRequests: newResults.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      averageResponseTime: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      minResponseTime: durations.length > 0 ? Math.min(...durations) : 0,
      maxResponseTime: durations.length > 0 ? Math.max(...durations) : 0,
      currentThroughput: 0, // Will be calculated separately
      errorRate: newResults.length > 0 ? (failed.length / newResults.length) * 100 : 0,
      isRunning: false,
      startTime: metrics.startTime
    };

    setMetrics(newMetrics);
  }, [metrics.startTime]);

  const executeTest = async () => {
    setIsRunning(true);
    setResults([]);
    setLogs([]);
    cancelTokenRef.current = false;
    
    const startTime = new Date();
    setMetrics(prev => ({
      ...prev,
      isRunning: true,
      startTime,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0
    }));

    // Start metrics tracking
    metricsIntervalRef.current = setInterval(() => {
      setMetrics(prev => {
        if (!prev.isRunning || !prev.startTime) return prev;
        
        const elapsed = (Date.now() - prev.startTime.getTime()) / 1000;
        const currentThroughput = elapsed > 0 ? prev.totalRequests / elapsed : 0;
        
        return {
          ...prev,
          currentThroughput
        };
      });
    }, 1000);

    let batchId: string | undefined;
    let batchDocuments: any[] = [];

    try {
      // Initialize MongoDB batch if field mapping is used
      if (curlConfig.mappedFields && Object.keys(curlConfig.mappedFields).length > 0 && connectionConfig) {
        const { database, collection, query } = connectionConfig;
        if (!database || !collection) {
          throw new Error('Database and collection are required for MongoDB mapping');
        }

        setLogs(prev => [...prev, `📦 Initializing MongoDB batch (${testConfig.numberOfRequests} documents)...`]);

        const batchResult = await window.electronAPI.mongodb.initializeBatch({
          database,
          collection,
          query,
          batchSize: testConfig.numberOfRequests
        });

        if (!batchResult.success || !batchResult.batchId) {
          throw new Error(batchResult.error || 'Failed to initialize batch');
        }

        batchId = batchResult.batchId;
        setLogs(prev => [...prev, `✅ MongoDB batch initialized`]);

        // Fetch all documents
        for (let i = 0; i < testConfig.numberOfRequests && !cancelTokenRef.current; i++) {
          const result = await window.electronAPI.mongodb.getNextDocument(batchId);
          if (!result.success) {
            throw new Error(result.error || 'Failed to get document from batch');
          }
          if (result.document) {
            batchDocuments.push(result.document);
          }
        }
        
        setLogs(prev => [...prev, `📄 Fetched ${batchDocuments.length} documents from MongoDB`]);
      }

      // Prepare requests
      const requests = Array(testConfig.numberOfRequests).fill(null).map((_, index) => {
        const batchDoc = batchDocuments[index] || null;
        
        let processedData = curlConfig.parsedCommand.data;
        if (typeof processedData === 'string') {
          try {
            processedData = JSON.parse(processedData);
          } catch (e) {
            // Keep as string if not valid JSON
          }
        }

        const requestConfig = {
          method: curlConfig.parsedCommand.method || 'GET',
          url: curlConfig.parsedCommand.url || '',
          headers: curlConfig.parsedCommand.headers ? { ...curlConfig.parsedCommand.headers } : {},
          data: processedData,
          mappedFields: curlConfig.mappedFields || {},
          connectionConfig,
          mongoDocument: batchDoc,
          timeout: testConfig.timeout
        };

        // Apply field mappings
        if (Object.keys(requestConfig.mappedFields).length > 0 && batchDoc) {
          
              Object.entries(requestConfig.mappedFields).forEach(([mappedFieldKey, mappedField]) => {
            if (!mappedField) return;

            let value = batchDoc[mappedField.targetField];
                if (value !== undefined && value !== null) {
                  // Check if this field was originally Base64 encoded and needs re-encoding
                  if (mappedField.isBase64Encoded) {
                    const originalValue = value;
                    // Re-encode the MongoDB value to Base64 JSON, preserving original structure
                    value = encodeToBase64Json(value, mappedFieldKey);
                    setLogs(prev => [...prev, `🔄 Base64 re-encoding field '${mappedFieldKey}': ${JSON.stringify(originalValue)} → ${value}`]);
                  }

                  if (mappedFieldKey.startsWith('url.queryParams.')) {
                    const paramName = mappedFieldKey.replace('url.queryParams.', '');
                    const urlObj = new URL(requestConfig.url);
                    urlObj.searchParams.set(paramName, value.toString());
                    requestConfig.url = urlObj.toString();
                  } else if (mappedFieldKey.startsWith('header.')) {
                    const pathParts = mappedFieldKey.split('.');
                    if (mappedField.isBase64Encoded && pathParts.length > 2) {
                      // For nested Base64 fields like "header.encodedHeader.email", 
                      // apply the re-encoded value to the parent header
                      const headerName = pathParts[1]; // "encodedHeader"
                      requestConfig.headers[headerName] = value.toString();
                      setLogs(prev => [...prev, `📝 Applied Base64 value to header '${headerName}': ${value}`]);
                    } else {
                      // For direct header fields like "header.Authorization"
                      const headerName = pathParts[1];
                      requestConfig.headers[headerName] = value.toString();
                    }
              } else if (mappedFieldKey.startsWith('data.')) {
                const dataPath = mappedFieldKey.replace('data.', '');
                if (requestConfig.data && typeof requestConfig.data === 'object') {
                  setNestedValue(requestConfig.data, dataPath, value);
                    }
                  }
                }
              });
        }

        return requestConfig;
      });

      setLogs(prev => [...prev, `🚀 Starting ${testConfig.numberOfRequests} requests...`]);

      // Execute requests
      const newResults: TestResult[] = [];
      
      if (testConfig.concurrent) {
        // Concurrent execution with rate limiting
        const batchSize = Math.max(1, Math.floor(testConfig.requestsPerSecond));
        const delay = testConfig.delayBetweenRequests; // Use delayBetweenRequests in milliseconds
        
        for (let i = 0; i < requests.length; i += batchSize) {
          if (cancelTokenRef.current) break;
          
          const batch = requests.slice(i, i + batchSize);
          const batchPromises = batch.map(async (req) => {
            try {
              const result = await window.electronAPI.executeRequest(req);
              const traceInfo = extractTraceInfo(result.headers);
              return {
                success: result.success,
                duration: result.duration || 0,
                statusCode: result.status, // Fixed: use result.status instead of result.response?.status
                error: result.error,
                headers: result.headers,
                traceInfo,
                response: { 
                  status: result.status, 
                  statusText: result.statusText, 
                  body: result.body 
                }
              };
            } catch (error) {
              return {
                success: false,
                duration: 0,
                statusCode: 0, // Network/connection error
                error: error instanceof Error ? error.message : 'Unknown error'
              };
            }
          });
          
          const batchResults = await Promise.all(batchPromises);
          newResults.push(...batchResults);
          setResults([...newResults]);
          
          // Update metrics
          updateMetrics(newResults);
          
          // Rate limiting delay in milliseconds
          if (i + batchSize < requests.length && delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      } else {
        // Sequential execution
        const delay = testConfig.delayBetweenRequests; // Use delayBetweenRequests in milliseconds
        
        for (let i = 0; i < requests.length; i++) {
          if (cancelTokenRef.current) break;
          
          try {
            const result = await window.electronAPI.executeRequest(requests[i]);
            const traceInfo = extractTraceInfo(result.headers);
            const testResult: TestResult = {
              success: result.success,
              duration: result.duration || 0,
              statusCode: result.status, // Fixed: use result.status instead of result.response?.status
              error: result.error,
              headers: result.headers,
              traceInfo,
              response: { 
                status: result.status, 
                statusText: result.statusText, 
                body: result.body 
              }
            };
            
            newResults.push(testResult);
            setResults([...newResults]);
            updateMetrics(newResults);
            
            if (delay > 0 && i < requests.length - 1) {
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          } catch (error) {
            const testResult: TestResult = {
              success: false,
              duration: 0,
              statusCode: 0, // Network/connection error
              error: error instanceof Error ? error.message : 'Unknown error'
            };
            newResults.push(testResult);
            setResults([...newResults]);
            updateMetrics(newResults);
          }
        }
      }

      setLogs(prev => [...prev, `✅ Test completed! ${newResults.filter(r => r.success).length}/${newResults.length} requests successful`]);

    } catch (error) {
      setLogs(prev => [...prev, `❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      // Cleanup
      if (batchId) {
        await window.electronAPI.mongodb.closeBatch(batchId);
      }
      
      setIsRunning(false);
      setMetrics(prev => ({ ...prev, isRunning: false }));
      
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
        metricsIntervalRef.current = null;
      }
    }
  };

  const stopTest = useCallback(() => {
    cancelTokenRef.current = true;
    setIsRunning(false);
    setMetrics(prev => ({ ...prev, isRunning: false }));
    
    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current);
      metricsIntervalRef.current = null;
    }
    
    setLogs(prev => [...prev, `⏹️ Test stopped by user`]);
  }, []);

  // Helper function to set nested values
  const setNestedValue = (obj: any, path: string, value: any) => {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
    };
  }, []);

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatDuration = (startTime: Date) => {
    const elapsed = (Date.now() - startTime.getTime()) / 1000;
    const minutes = Math.floor(elapsed / 60);
    const seconds = Math.floor(elapsed % 60);
    return `${minutes}m ${seconds}s`;
  };

  // Helper function to encode a value to Base64 JSON string
  const encodeToBase64Json = useCallback((value: any, originalFieldPath?: string): string => {
    try {
      // If the value is already an object, just stringify and encode it
      if (typeof value === 'object' && value !== null) {
        const jsonString = JSON.stringify(value);
        return btoa(jsonString);
      }
      
      // For primitive values, try to infer the structure from the original Base64
      // by checking what the original contained
      if (originalFieldPath && curlConfig) {
        // Try to get the original Base64 value to understand its structure
        const pathParts = originalFieldPath.split('.');
        
        // Handle nested header paths like "header.encodedHeader.email"
        if (pathParts[0] === 'header' && pathParts.length >= 2) {
          const headerName = pathParts[1];
          const originalHeaderValue = curlConfig.parsedCommand.headers?.[headerName];
          if (originalHeaderValue) {
            try {
              // Decode the original Base64 to see its structure
              const originalDecoded = JSON.parse(atob(originalHeaderValue));
              
              if (pathParts.length === 2) {
                // Direct header mapping like "header.encodedHeader"
                if (typeof originalDecoded === 'object' && originalDecoded !== null) {
                  const keys = Object.keys(originalDecoded);
                  if (keys.length === 1) {
                    // Replicate the original structure with the new value
                    const newObject = { [keys[0]]: value };
                    return btoa(JSON.stringify(newObject));
                  }
                }
              } else if (pathParts.length > 2) {
                // Nested mapping like "header.encodedHeader.email"
                // We need to reconstruct the entire Base64 object, replacing just the nested field
                const nestedFieldName = pathParts[2]; // "email"
                if (typeof originalDecoded === 'object' && originalDecoded !== null) {
                  const newObject = { ...originalDecoded, [nestedFieldName]: value };
                  return btoa(JSON.stringify(newObject));
                }
              }
            } catch (e) {
              // If we can't decode the original, fall back to simple encoding
            }
          }
        }
      }
      
      // Fallback: just encode the value as-is
      const jsonString = JSON.stringify(value);
      return btoa(jsonString);
    } catch (error) {
      return String(value); // Fallback to string representation
    }
  }, [curlConfig]);

  // Extract trace information from response headers
  const extractTraceInfo = useCallback((headers: Record<string, string> = {}) => {
    const traceInfo: TestResult['traceInfo'] = {};
    
    // Common trace header patterns (case-insensitive)
    const tracePatterns = {
      spanId: ['x-span-id', 'span-id', 'spanid', 'x-spanid'],
      sessionId: ['x-session-id', 'session-id', 'sessionid', 'x-sessionid'],
      traceId: ['x-trace-id', 'trace-id', 'traceid', 'x-traceid', 'x-b3-traceid', 'traceid'],
      requestId: ['x-request-id', 'request-id', 'requestid', 'x-requestid'],
      correlationId: ['x-correlation-id', 'correlation-id', 'correlationid', 'x-correlationid']
    };

    Object.entries(tracePatterns).forEach(([key, patterns]) => {
      for (const pattern of patterns) {
        if (headers[pattern]) {
          (traceInfo as any)[key] = headers[pattern];
          break;
        }
      }
    });

    // Also check for any header that contains 'trace' or 'span' in the name
    Object.keys(headers).forEach(headerName => {
      const lowerName = headerName.toLowerCase();
      if (lowerName.includes('trace') && !traceInfo.traceId) {
        traceInfo.traceId = headers[headerName];
      }
      if (lowerName.includes('span') && !traceInfo.spanId) {
        traceInfo.spanId = headers[headerName];
      }
      if (lowerName.includes('session') && !traceInfo.sessionId) {
        traceInfo.sessionId = headers[headerName];
      }
      if (lowerName.includes('request') && !traceInfo.requestId) {
        traceInfo.requestId = headers[headerName];
      }
    });

    return Object.keys(traceInfo).length > 0 ? traceInfo : undefined;
  }, []);

  // Get filtered results by status group
  const getFilteredResults = useCallback((statusGroup: string) => {
    return results.filter(result => {
      const resultStatusGroup = getStatusGroup(result.statusCode || 0);
      return resultStatusGroup === statusGroup;
    });
  }, [results]);

  // Handle pie chart segment click
  const handlePieClick = useCallback((data: any) => {
    setSelectedStatusGroup(data.name);
    setShowTraceModal(true);
  }, []);

  // Copy text to clipboard
  const copyToClipboard = useCallback(async (text: string, _label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }, []);

  // Generate status code chart data
  const getStatusCodeChartData = useCallback(() => {
    const statusCodes: Record<string, number> = {};
    
    results.forEach(result => {
      const statusCode = result.statusCode || 0;
      const statusGroup = getStatusGroup(statusCode);
      statusCodes[statusGroup] = (statusCodes[statusGroup] || 0) + 1;
    });

    const colors = {
      '2xx Success': {
        primary: '#10b981',
        gradient: 'linear-gradient(135deg, #34d399, #10b981, #059669)',
        shadow: 'rgba(16, 185, 129, 0.4)'
      },
      '3xx Redirect': {
        primary: '#3b82f6',
        gradient: 'linear-gradient(135deg, #60a5fa, #3b82f6, #2563eb)',
        shadow: 'rgba(59, 130, 246, 0.4)'
      },
      '4xx Client Error': {
        primary: '#f59e0b',
        gradient: 'linear-gradient(135deg, #fbbf24, #f59e0b, #d97706)',
        shadow: 'rgba(245, 158, 11, 0.4)'
      },
      '5xx Server Error': {
        primary: '#ef4444',
        gradient: 'linear-gradient(135deg, #f87171, #ef4444, #dc2626)',
        shadow: 'rgba(239, 68, 68, 0.4)'
      },
      'Network/Other Error': {
        primary: '#6b7280',
        gradient: 'linear-gradient(135deg, #9ca3af, #6b7280, #4b5563)',
        shadow: 'rgba(107, 114, 128, 0.4)'
      }
    };

    return Object.entries(statusCodes).map(([status, count]) => ({
      name: status,
      value: count,
      color: colors[status as keyof typeof colors]?.primary || '#6b7280',
      gradient: colors[status as keyof typeof colors]?.gradient || 'linear-gradient(135deg, #9ca3af, #6b7280)',
      shadow: colors[status as keyof typeof colors]?.shadow || 'rgba(107, 114, 128, 0.4)'
    }));
  }, [results]);

  const getStatusGroup = (statusCode: number): string => {
    if (statusCode === 0) return 'Network/Other Error';
    if (statusCode >= 200 && statusCode < 300) return '2xx Success';
    if (statusCode >= 300 && statusCode < 400) return '3xx Redirect';
    if (statusCode >= 400 && statusCode < 500) return '4xx Client Error';
    if (statusCode >= 500 && statusCode < 600) return '5xx Server Error';
    return 'Network/Other Error';
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null; // Don't show labels for slices smaller than 5%
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.7;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize="14"
        fontWeight="bold"
        style={{
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
          textShadow: '0 1px 2px rgba(0,0,0,0.8)'
        }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5 mr-2" />
            Back
          </button>
        
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            API Load Testing
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            MongoDB → API performance testing with real data
          </p>
        </div>

        <div className="w-16"></div> {/* Spacer for alignment */}
      </div>

      {/* Test Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
          Test Configuration
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label htmlFor="numberOfRequests" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Number of Requests
              <div className="group relative inline-block ml-2">
                <InformationCircleIcon className="w-4 h-4 text-gray-400" />
                <div className="hidden group-hover:block absolute z-10 w-48 px-2 py-1 text-xs text-white bg-gray-900 rounded-md -right-1 transform translate-x-full">
                  Total number of API requests to execute
                </div>
              </div>
            </label>
            <input
              type="number"
              id="numberOfRequests"
              min="1"
              max="100000"
              value={testConfig.numberOfRequests}
              onChange={(e) => handleConfigChange('numberOfRequests', parseInt(e.target.value) || 1)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
              disabled={isRunning}
            />
          </div>
          
          <div>
            <label htmlFor="requestsPerSecond" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Requests/Second
              <div className="group relative inline-block ml-2">
                <InformationCircleIcon className="w-4 h-4 text-gray-400" />
                <div className="hidden group-hover:block absolute z-10 w-48 px-2 py-1 text-xs text-white bg-gray-900 rounded-md -right-1 transform translate-x-full">
                  Rate limit for API requests
                </div>
              </div>
            </label>
            <input
              type="number"
              id="requestsPerSecond"
              min="1"
              max="1000"
              value={testConfig.requestsPerSecond}
              onChange={(e) => handleConfigChange('requestsPerSecond', parseInt(e.target.value) || 1)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
              disabled={isRunning}
            />
          </div>
          
          <div>
            <label htmlFor="delayBetweenRequests" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Requests Delay (ms)
              <div className="group relative inline-block ml-2">
                <InformationCircleIcon className="w-4 h-4 text-gray-400" />
                <div className="hidden group-hover:block absolute z-10 w-48 px-2 py-1 text-xs text-white bg-gray-900 rounded-md -right-1 transform translate-x-full">
                  Delay in milliseconds between requests
                </div>
              </div>
            </label>
            <input
              type="number"
              id="delayBetweenRequests"
              min="0"
              max="10000"
              value={testConfig.delayBetweenRequests}
              onChange={(e) => handleConfigChange('delayBetweenRequests', parseInt(e.target.value) || 0)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
              disabled={isRunning}
            />
        </div>

          <div>
            <label htmlFor="timeout" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Timeout (ms)
              <div className="group relative inline-block ml-2">
              <InformationCircleIcon className="w-4 h-4 text-gray-400" />
              <div className="hidden group-hover:block absolute z-10 w-48 px-2 py-1 text-xs text-white bg-gray-900 rounded-md -right-1 transform translate-x-full">
                  Request timeout in milliseconds
                </div>
              </div>
            </label>
            <input
              type="number"
              id="timeout"
              min="1000"
              max="300000"
              value={testConfig.timeout}
              onChange={(e) => handleConfigChange('timeout', parseInt(e.target.value) || 30000)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
              disabled={isRunning}
            />
            </div>
          
          <div className="flex items-center pt-6">
            <input
              type="checkbox"
              id="concurrent"
              checked={testConfig.concurrent}
              onChange={(e) => handleConfigChange('concurrent', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={isRunning}
            />
            <label htmlFor="concurrent" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Concurrent execution
          </label>
          </div>
        </div>
      </div>

      {/* Test Controls */}
      <div className="flex justify-center space-x-4">
        <button
          onClick={isRunning ? stopTest : executeTest}
          disabled={!curlConfig.parsedCommand.url}
          className={`inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
            isRunning
              ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
              : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
          }`}
        >
          {isRunning ? (
            <>
              <StopIcon className="w-5 h-5 mr-2" />
              Stop Test
            </>
          ) : (
            <>
              <PlayIcon className="w-5 h-5 mr-2" />
              Start Test
            </>
          )}
        </button>
      </div>

      {/* Real-time Metrics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
          Performance Metrics
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatNumber(metrics.totalRequests)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Requests</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatNumber(metrics.successfulRequests)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Successful</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatNumber(metrics.failedRequests)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Failed</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {Math.round(metrics.averageResponseTime)}ms
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Avg Response Time</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">
              {Math.round(metrics.currentThroughput)}/sec
                </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Current Throughput</div>
                </div>
          
          <div className="text-center">
            <div className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">
              {metrics.errorRate.toFixed(1)}%
                </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Error Rate</div>
          </div>
          
          <div className="text-center">
            <div className="text-lg font-semibold text-teal-600 dark:text-teal-400">
              {metrics.minResponseTime > 0 ? `${metrics.minResponseTime}ms - ${metrics.maxResponseTime}ms` : 'N/A'}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Response Time Range</div>
          </div>
        </div>

        {metrics.isRunning && metrics.startTime && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Running for {formatDuration(metrics.startTime)} • 
              Progress: {Math.round((metrics.totalRequests / testConfig.numberOfRequests) * 100)}%
            </div>
            <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((metrics.totalRequests / testConfig.numberOfRequests) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Status Code Distribution Chart */}
      {results.length > 0 && (
        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 shadow-2xl relative overflow-hidden transform transition-all duration-700 ease-out animate-in fade-in slide-in-from-bottom-4">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 to-purple-50/30 dark:from-blue-900/10 dark:to-purple-900/10 pointer-events-none"></div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-200/20 to-transparent dark:from-blue-600/10 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-purple-200/20 to-transparent dark:from-purple-600/10 rounded-full -ml-12 -mb-12"></div>
          
          <div className="relative z-10">
            <h4 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-6">
              HTTP Status Code Distribution
              <span className="ml-3 text-sm text-gray-500 dark:text-gray-400 font-normal">(Click segments for trace details)</span>
            </h4>
            <div className="h-96 bg-gradient-to-br from-white/50 to-gray-100/30 dark:from-gray-700/30 dark:to-gray-800/50 rounded-xl backdrop-blur-sm border border-white/20 dark:border-gray-600/20 shadow-inner hover:shadow-2xl transition-all duration-300 group p-4">
              {getStatusCodeChartData().length > 0 ? (
                <div className="w-full h-full transform transition-all duration-300 group-hover:scale-105">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                <Pie
                  data={getStatusCodeChartData()}
                  cx="50%"
                  cy="48%"
                  labelLine={false}
                  label={renderCustomizedLabel}
                  outerRadius={120}
                  innerRadius={35}
                  fill="#8884d8"
                  dataKey="value"
                  onClick={handlePieClick}
                  style={{ 
                    cursor: 'pointer',
                    filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.15))',
                    transform: 'perspective(1000px) rotateX(-5deg) rotateY(5deg)',
                    transition: 'all 0.3s ease-in-out'
                  }}
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth={2}
                >
                  {getStatusCodeChartData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [value, 'Requests']}
                  labelFormatter={(label: string) => `Status: ${label}`}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                    backdropFilter: 'blur(8px)',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={48}
                  iconType="circle"
                  formatter={(value, entry) => (
                    <span 
                      className="text-sm font-medium transition-all duration-200 hover:scale-105" 
                      style={{ 
                        color: entry.color,
                        textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                      }}
                    >
                      {value}
                    </span>
                  )}
                  wrapperStyle={{
                    paddingTop: '20px',
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                  }}
                />
              </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center text-gray-500 dark:text-gray-400">
                      <div className="text-2xl mb-2">📊</div>
                      <div>No test results yet</div>
                      <div className="text-sm">Run a test to see the status distribution</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
      )}

      {/* Live Logs */}
      {logs.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
          <h4 className="text-md font-medium text-white mb-3">
            Live Logs
          </h4>
          <div className="bg-black rounded p-3 max-h-48 overflow-y-auto font-mono text-sm">
            {logs.map((log, index) => (
              <div key={index} className="text-green-400 mb-1">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test Summary */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
          Test Configuration Summary
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h5 className="font-medium text-gray-900 dark:text-white mb-2">Data Source</h5>
            <div className="space-y-1 text-gray-600 dark:text-gray-400">
              <div>Database: <span className="font-mono">{connectionConfig.database}</span></div>
              <div>Collection: <span className="font-mono">{connectionConfig.collection}</span></div>
              {connectionConfig.query && <div>Query: <span className="font-mono">{JSON.stringify(connectionConfig.query)}</span></div>}
            </div>
          </div>
          
          <div>
            <h5 className="font-medium text-gray-900 dark:text-white mb-2">API Target</h5>
            <div className="space-y-1 text-gray-600 dark:text-gray-400">
              <div>Method: <span className="font-mono">{curlConfig.parsedCommand.method}</span></div>
              <div>URL: <span className="font-mono break-all">{curlConfig.parsedCommand.url}</span></div>
              <div>Mapped Fields: <span className="font-mono">{Object.keys(curlConfig.mappedFields || {}).length}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Trace Details Modal */}
      {showTraceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {selectedStatusGroup} - Trace Details
              </h3>
              <button
                onClick={() => setShowTraceModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="overflow-auto flex-1">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Duration (ms)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Trace ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Span ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Session ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Request ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Error
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {getFilteredResults(selectedStatusGroup).map((result, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <div className="flex items-center space-x-1">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            result.success 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {result.statusCode || 'N/A'}
                          </span>
                          {result.statusCode && (
                            <button
                              onClick={() => copyToClipboard(result.statusCode!.toString(), 'Status Code')}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                              title="Copy Status Code"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        <div className="flex items-center space-x-1">
                          <span>{result.duration}ms</span>
                          <button
                            onClick={() => copyToClipboard(result.duration.toString(), 'Duration')}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            title="Copy Duration"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-mono">
                        {result.traceInfo?.traceId ? (
                          <div className="flex items-center space-x-1">
                            <span className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded text-xs">
                              {result.traceInfo.traceId.length > 16 
                                ? `${result.traceInfo.traceId.substring(0, 16)}...` 
                                : result.traceInfo.traceId
                              }
                            </span>
                            <button
                              onClick={() => copyToClipboard(result.traceInfo!.traceId!, 'Trace ID')}
                              className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                              title="Copy Trace ID"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-mono">
                        {result.traceInfo?.spanId ? (
                          <div className="flex items-center space-x-1">
                            <span className="bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded text-xs">
                              {result.traceInfo.spanId.length > 12 
                                ? `${result.traceInfo.spanId.substring(0, 12)}...` 
                                : result.traceInfo.spanId
                              }
                            </span>
                            <button
                              onClick={() => copyToClipboard(result.traceInfo!.spanId!, 'Span ID')}
                              className="p-1 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                              title="Copy Span ID"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-mono">
                        {result.traceInfo?.sessionId ? (
                          <div className="flex items-center space-x-1">
                            <span className="bg-green-100 dark:bg-green-900 px-2 py-1 rounded text-xs">
                              {result.traceInfo.sessionId.length > 12 
                                ? `${result.traceInfo.sessionId.substring(0, 12)}...` 
                                : result.traceInfo.sessionId
                              }
                            </span>
                            <button
                              onClick={() => copyToClipboard(result.traceInfo!.sessionId!, 'Session ID')}
                              className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                              title="Copy Session ID"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-mono">
                        {result.traceInfo?.requestId ? (
                          <div className="flex items-center space-x-1">
                            <span className="bg-orange-100 dark:bg-orange-900 px-2 py-1 rounded text-xs">
                              {result.traceInfo.requestId.length > 12 
                                ? `${result.traceInfo.requestId.substring(0, 12)}...` 
                                : result.traceInfo.requestId
                              }
                            </span>
                            <button
                              onClick={() => copyToClipboard(result.traceInfo!.requestId!, 'Request ID')}
                              className="p-1 text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                              title="Copy Request ID"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {result.error ? (
                          <span className="text-red-600 dark:text-red-400 text-xs">
                            {result.error.length > 50 ? `${result.error.substring(0, 50)}...` : result.error}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <button
                          onClick={() => {
                            const allInfo = [
                              `Status: ${result.statusCode || 'N/A'}`,
                              `Duration: ${result.duration}ms`,
                              result.traceInfo?.traceId ? `Trace ID: ${result.traceInfo.traceId}` : null,
                              result.traceInfo?.spanId ? `Span ID: ${result.traceInfo.spanId}` : null,
                              result.traceInfo?.sessionId ? `Session ID: ${result.traceInfo.sessionId}` : null,
                              result.traceInfo?.requestId ? `Request ID: ${result.traceInfo.requestId}` : null,
                              result.error ? `Error: ${result.error}` : null
                            ].filter(Boolean).join('\n');
                            copyToClipboard(allInfo, 'All trace info');
                          }}
                          className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                          title="Copy all trace information"
                        >
                          Copy All
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {getFilteredResults(selectedStatusGroup).length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No results found for {selectedStatusGroup}
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total {selectedStatusGroup} requests: {getFilteredResults(selectedStatusGroup).length} | 
                With trace data: {getFilteredResults(selectedStatusGroup).filter(r => r.traceInfo).length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Trace Details Modal */}
      {showTraceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {selectedStatusGroup} - Trace Details
              </h3>
              <button
                onClick={() => setShowTraceModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="overflow-auto flex-1">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Duration (ms)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Trace ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Span ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Session ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Request ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Error
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {getFilteredResults(selectedStatusGroup).map((result, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      {/* Status Code with Copy Button */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <div className="flex items-center space-x-1">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            result.success 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {result.statusCode || 'N/A'}
                          </span>
                          {result.statusCode && (
                            <button
                              onClick={() => copyToClipboard(result.statusCode!.toString(), 'Status Code')}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                              title="Copy Status Code"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                      
                      {/* Duration with Copy Button */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        <div className="flex items-center space-x-1">
                          <span>{result.duration}ms</span>
                          <button
                            onClick={() => copyToClipboard(result.duration.toString(), 'Duration')}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            title="Copy Duration"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      
                      {/* Trace ID with Copy Button */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-mono">
                        {result.traceInfo?.traceId ? (
                          <div className="flex items-center space-x-1">
                            <span className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded text-xs">
                              {result.traceInfo.traceId.length > 16 
                                ? `${result.traceInfo.traceId.substring(0, 16)}...` 
                                : result.traceInfo.traceId
                              }
                            </span>
                            <button
                              onClick={() => copyToClipboard(result.traceInfo!.traceId!, 'Trace ID')}
                              className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                              title="Copy Trace ID"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      
                      {/* Span ID with Copy Button */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-mono">
                        {result.traceInfo?.spanId ? (
                          <div className="flex items-center space-x-1">
                            <span className="bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded text-xs">
                              {result.traceInfo.spanId.length > 12 
                                ? `${result.traceInfo.spanId.substring(0, 12)}...` 
                                : result.traceInfo.spanId
                              }
                            </span>
                            <button
                              onClick={() => copyToClipboard(result.traceInfo!.spanId!, 'Span ID')}
                              className="p-1 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                              title="Copy Span ID"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      
                      {/* Session ID with Copy Button */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-mono">
                        {result.traceInfo?.sessionId ? (
                          <div className="flex items-center space-x-1">
                            <span className="bg-green-100 dark:bg-green-900 px-2 py-1 rounded text-xs">
                              {result.traceInfo.sessionId.length > 12 
                                ? `${result.traceInfo.sessionId.substring(0, 12)}...` 
                                : result.traceInfo.sessionId
                              }
                            </span>
                            <button
                              onClick={() => copyToClipboard(result.traceInfo!.sessionId!, 'Session ID')}
                              className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                              title="Copy Session ID"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      
                      {/* Request ID with Copy Button */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-mono">
                        {result.traceInfo?.requestId ? (
                          <div className="flex items-center space-x-1">
                            <span className="bg-orange-100 dark:bg-orange-900 px-2 py-1 rounded text-xs">
                              {result.traceInfo.requestId.length > 12 
                                ? `${result.traceInfo.requestId.substring(0, 12)}...` 
                                : result.traceInfo.requestId
                              }
                            </span>
                            <button
                              onClick={() => copyToClipboard(result.traceInfo!.requestId!, 'Request ID')}
                              className="p-1 text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                              title="Copy Request ID"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {result.error ? (
                          <span className="text-red-600 dark:text-red-400 text-xs">
                            {result.error.length > 50 ? `${result.error.substring(0, 50)}...` : result.error}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      
                      {/* Copy All Button */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <button
                          onClick={() => {
                            const allInfo = [
                              `Status: ${result.statusCode || 'N/A'}`,
                              `Duration: ${result.duration}ms`,
                              result.traceInfo?.traceId ? `Trace ID: ${result.traceInfo.traceId}` : null,
                              result.traceInfo?.spanId ? `Span ID: ${result.traceInfo.spanId}` : null,
                              result.traceInfo?.sessionId ? `Session ID: ${result.traceInfo.sessionId}` : null,
                              result.traceInfo?.requestId ? `Request ID: ${result.traceInfo.requestId}` : null,
                              result.error ? `Error: ${result.error}` : null
                            ].filter(Boolean).join('\n');
                            copyToClipboard(allInfo, 'All trace info');
                          }}
                          className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                          title="Copy all trace information"
                        >
                          Copy All
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {getFilteredResults(selectedStatusGroup).length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No results found for {selectedStatusGroup}
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total {selectedStatusGroup} requests: {getFilteredResults(selectedStatusGroup).length} | 
                With trace data: {getFilteredResults(selectedStatusGroup).filter(r => r.traceInfo).length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 