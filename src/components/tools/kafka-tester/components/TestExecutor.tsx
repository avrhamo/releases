import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronLeftIcon, PlayIcon, StopIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface ConnectionConfig {
  connectionString: string;
  database?: string;
  collection?: string;
  query?: string;
}

interface KafkaConfig {
  brokers: string[];
  clientId: string;
  topic?: string;
  securityProtocol?: 'PLAINTEXT' | 'SSL' | 'SASL_PLAINTEXT' | 'SASL_SSL';
  saslMechanism?: 'PLAIN' | 'SCRAM-SHA-256' | 'SCRAM-SHA-512' | 'GSSAPI';
  ssl?: {
    caLocation?: string;
    certLocation?: string;
    keyLocation?: string;
    keyPassword?: string;
  };
  kerberos?: {
    keytabLocation?: string;
    krb5ConfigLocation?: string;
    serviceName?: string;
    principal?: string;
  };
  sasl?: {
    username?: string;
    password?: string;
  };
}

interface MessageTemplate {
  rawTemplate: string;
  parsedTemplate: {
    key?: string;
    value: any;
    headers?: Record<string, string>;
  };
}

interface MappingInfo {
  targetField: string;
  type: 'mongodb' | 'fixed' | 'special';
  value?: string;
}

interface TestConfig {
  numberOfMessages: number;
  messagesPerSecond: number;
  batchSize: number;
  isAsync: boolean;
}

interface TestMetrics {
  messagesSent: number;
  messagesPerSecond: number;
  totalErrors: number;
  averageLatency: number;
  startTime: Date;
  isRunning: boolean;
  currentThroughput: number;
}

interface TestExecutorProps {
  connectionConfig: ConnectionConfig;
  kafkaConfig: KafkaConfig;
  messageTemplate: MessageTemplate;
  mappedFields: Record<string, MappingInfo>;
  testConfig: TestConfig;
  onConfigChange: (config: TestConfig) => void;
  onBack: () => void;
}

export const TestExecutor: React.FC<TestExecutorProps> = ({
  connectionConfig,
  kafkaConfig,
  messageTemplate,
  mappedFields,
  testConfig: initialTestConfig,
  onConfigChange,
  onBack
}) => {
  // Ensure we always have valid configuration objects with defaults
  const testConfig = initialTestConfig || {
    numberOfMessages: 1000,
    messagesPerSecond: 100,
    batchSize: 10,
    isAsync: true
  };

  const safeConnectionConfig = connectionConfig || {
    connectionString: '',
    database: undefined,
    collection: undefined,
    query: undefined
  };

  const safeKafkaConfig = kafkaConfig || {
    brokers: ['localhost:9092'],
    clientId: 'kafka-performance-tester',
    topic: undefined,
    securityProtocol: 'PLAINTEXT' as const,
    saslMechanism: undefined,
    ssl: {
      caLocation: undefined,
      certLocation: undefined,
      keyLocation: undefined,
      keyPassword: undefined
    },
    kerberos: {
      keytabLocation: undefined,
      krb5ConfigLocation: undefined,
      serviceName: 'kafka',
      principal: undefined
    },
    sasl: {
      username: undefined,
      password: undefined
    }
  };

  const safeMessageTemplate = messageTemplate || {
    rawTemplate: '',
    parsedTemplate: {}
  };

  const safeMappedFields = mappedFields || {};

  const [metrics, setMetrics] = useState<TestMetrics>({
    messagesSent: 0,
    messagesPerSecond: 0,
    totalErrors: 0,
    averageLatency: 0,
    startTime: new Date(),
    isRunning: false,
    currentThroughput: 0
  });

  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const batchRef = useRef<string | null>(null);

  const handleConfigChange = useCallback((key: keyof TestConfig, value: any) => {
    onConfigChange({
      ...testConfig,
      [key]: value
    });
  }, [testConfig, onConfigChange]);

  const startTest = useCallback(async () => {
    try {
      // Connect to Kafka
      const kafkaResult = await (window.electronAPI as any).connectToKafka(safeKafkaConfig);
      if (!kafkaResult.success) {
        throw new Error('Failed to connect to Kafka');
      }

      // Initialize MongoDB Batch
      if (!safeConnectionConfig.database || !safeConnectionConfig.collection) {
        throw new Error('Database and collection are required');
      }

      const batchResult = await (window.electronAPI as any).mongodb.initializeBatch({
        database: safeConnectionConfig.database,
        collection: safeConnectionConfig.collection,
        query: safeConnectionConfig.query,
        batchSize: testConfig.batchSize
      });

      if (!batchResult.success) {
        throw new Error(batchResult.error || 'Failed to initialize MongoDB batch');
      }
      batchRef.current = batchResult.batchId;

      // Start test execution
      setMetrics(prev => ({
        ...prev,
        messagesSent: 0,
        totalErrors: 0,
        startTime: new Date(),
        isRunning: true
      }));

      // Start metrics tracking
      metricsIntervalRef.current = setInterval(() => {
        setMetrics(prev => {
          if (!prev.isRunning) return prev;

          const elapsed = (Date.now() - prev.startTime.getTime()) / 1000;
          const currentThroughput = elapsed > 0 ? prev.messagesSent / elapsed : 0;

          return {
            ...prev,
            messagesPerSecond: currentThroughput,
            currentThroughput
          };
        });
      }, 1000);

      // Execute test
      await executeTestBatch();

    } catch (error) {
      console.error('Test execution failed:', error);
      setMetrics(prev => ({
        ...prev,
        isRunning: false
      }));

      // Clean up interval on error
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
        metricsIntervalRef.current = null;
      }
    }
  }, [safeConnectionConfig, safeKafkaConfig, testConfig, safeMessageTemplate, safeMappedFields]);

  const executeTestBatch = useCallback(async () => {
    if (!batchRef.current) return;

    let messagesSent = 0;
    let errors = 0;
    const startTime = Date.now();

    // Determine batch size for Kafka production (can be different from MongoDB batch size)
    // Use a reasonable chunk size to avoid blocking the UI too long, e.g., 100 or testConfig.batchSize
    const productionBatchSize = Math.max(testConfig.batchSize, 100);

    while (messagesSent < testConfig.numberOfMessages && metrics.isRunning) {
      try {
        const remaining = testConfig.numberOfMessages - messagesSent;
        const currentBatchSize = Math.min(productionBatchSize, remaining);

        const start = Date.now();

        // Execute batch on backend
        // Note: We cast window.electronAPI to any because the type definition might not be updated yet
        const result = await (window.electronAPI as any).executeKafkaTest({
          testConfig: { ...testConfig, numberOfMessages: currentBatchSize },
          kafkaConfig: safeKafkaConfig,
          connectionConfig: safeConnectionConfig,
          messageTemplate: safeMessageTemplate,
          mappedFields: safeMappedFields,
          batchId: batchRef.current
        });

        if (!result.success) {
          throw new Error(result.error || 'Batch execution failed');
        }

        const latency = Date.now() - start;
        const batchSentCount = result.sentCount || currentBatchSize;

        messagesSent += batchSentCount;

        setMetrics(prev => ({
          ...prev,
          messagesSent,
          // Update average latency (weighted average could be better but simple average of batches is ok for now)
          averageLatency: (prev.averageLatency * (messagesSent - batchSentCount) + latency) / messagesSent
        }));

        // Rate limiting (approximate)
        if (testConfig.messagesPerSecond > 0) {
          const expectedDuration = (messagesSent / testConfig.messagesPerSecond) * 1000;
          const actualDuration = Date.now() - startTime;
          const delay = expectedDuration - actualDuration;
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

      } catch (error) {
        errors++;
        setMetrics(prev => ({
          ...prev,
          totalErrors: prev.totalErrors + 1
        }));
        console.error(`Batch execution failed:`, error);
        // Break on critical error or continue?
        // For now, maybe pause or stop if too many errors?
        // Let's stop to prevent infinite error loops
        break;
      }
    }

    // Test completed
    setMetrics(prev => ({
      ...prev,
      isRunning: false
    }));

    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current);
    }
  }, [batchRef, testConfig, safeKafkaConfig, safeConnectionConfig, safeMessageTemplate, safeMappedFields, metrics.isRunning]);

  const stopTest = useCallback(async () => {
    setMetrics(prev => ({
      ...prev,
      isRunning: false
    }));

    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current);
    }

    if (batchRef.current) {
      await window.electronAPI.mongodb.closeBatch(batchRef.current);
      batchRef.current = null;
    }

    await (window.electronAPI as any).disconnectFromKafka();
  }, [batchRef]);

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
            Performance Test Execution
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            MongoDB → Kafka performance testing with real data
          </p>
        </div>

        <div className="w-16"></div> {/* Spacer for alignment */}
      </div>

      {/* Test Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
          Test Configuration
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="numberOfMessages" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Number of Messages
              <div className="group relative inline-block ml-2">
                <InformationCircleIcon className="w-4 h-4 text-gray-400" />
                <div className="hidden group-hover:block absolute z-10 w-48 px-2 py-1 text-xs text-white bg-gray-900 rounded-md -right-1 transform translate-x-full">
                  Total number of messages to produce to Kafka
                </div>
              </div>
            </label>
            <input
              type="number"
              id="numberOfMessages"
              min="1"
              max="1000000"
              value={testConfig.numberOfMessages}
              onChange={(e) => handleConfigChange('numberOfMessages', parseInt(e.target.value) || 1)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
              disabled={metrics.isRunning}
            />
          </div>

          <div>
            <label htmlFor="messagesPerSecond" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Messages/Second
              <div className="group relative inline-block ml-2">
                <InformationCircleIcon className="w-4 h-4 text-gray-400" />
                <div className="hidden group-hover:block absolute z-10 w-48 px-2 py-1 text-xs text-white bg-gray-900 rounded-md -right-1 transform translate-x-full">
                  Rate limit for message production
                </div>
              </div>
            </label>
            <input
              type="number"
              id="messagesPerSecond"
              min="1"
              max="10000"
              value={testConfig.messagesPerSecond}
              onChange={(e) => handleConfigChange('messagesPerSecond', parseInt(e.target.value) || 1)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
              disabled={metrics.isRunning}
            />
          </div>

          <div>
            <label htmlFor="batchSize" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              MongoDB Batch Size
              <div className="group relative inline-block ml-2">
                <InformationCircleIcon className="w-4 h-4 text-gray-400" />
                <div className="hidden group-hover:block absolute z-10 w-48 px-2 py-1 text-xs text-white bg-gray-900 rounded-md -right-1 transform translate-x-full">
                  Number of documents to fetch from MongoDB in each batch
                </div>
              </div>
            </label>
            <input
              type="number"
              id="batchSize"
              min="1"
              max="1000"
              value={testConfig.batchSize}
              onChange={(e) => handleConfigChange('batchSize', parseInt(e.target.value) || 1)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
              disabled={metrics.isRunning}
            />
          </div>

          <div className="flex items-center pt-6">
            <input
              type="checkbox"
              id="isAsync"
              checked={testConfig.isAsync}
              onChange={(e) => handleConfigChange('isAsync', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={metrics.isRunning}
            />
            <label htmlFor="isAsync" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Async execution
            </label>
          </div>
        </div>
      </div>

      {/* Test Controls */}
      <div className="flex justify-center space-x-4">
        <button
          onClick={metrics.isRunning ? stopTest : startTest}
          disabled={!safeKafkaConfig.topic}
          className={`inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${metrics.isRunning
            ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
            : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
            }`}
        >
          {metrics.isRunning ? (
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
          Real-time Metrics
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatNumber(metrics.messagesSent)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Messages Sent</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatNumber(Math.round(metrics.currentThroughput))}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Current Throughput/sec</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {Math.round(metrics.averageLatency)}ms
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Avg Latency</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatNumber(metrics.totalErrors)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Errors</div>
          </div>
        </div>

        {metrics.isRunning && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Running for {formatDuration(metrics.startTime)} •
              Progress: {Math.round((metrics.messagesSent / testConfig.numberOfMessages) * 100)}%
            </div>
            <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((metrics.messagesSent / testConfig.numberOfMessages) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Configuration Summary */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
          Test Summary
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h5 className="font-medium text-gray-900 dark:text-white mb-2">Data Source</h5>
            <div className="space-y-1 text-gray-600 dark:text-gray-400">
              <div>Database: <span className="font-mono">{safeConnectionConfig.database}</span></div>
              <div>Collection: <span className="font-mono">{safeConnectionConfig.collection}</span></div>
              {safeConnectionConfig.query && <div>Query: <span className="font-mono">{safeConnectionConfig.query}</span></div>}
            </div>
          </div>

          <div>
            <h5 className="font-medium text-gray-900 dark:text-white mb-2">Kafka Target</h5>
            <div className="space-y-1 text-gray-600 dark:text-gray-400">
              <div>Brokers: <span className="font-mono">{safeKafkaConfig.brokers.join(', ')}</span></div>
              <div>Topic: <span className="font-mono">{safeKafkaConfig.topic}</span></div>
              <div>Security: <span className="font-mono">{safeKafkaConfig.securityProtocol}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 