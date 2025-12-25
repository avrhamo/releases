import React, { useCallback, useEffect } from 'react';
import { useToolState } from '../../../hooks/useToolState';
import { BaseToolProps } from '../../types';
import { MongoDBConnectionForm } from '../api-tester/MongoDBConnectionForm';
import { DatabaseCollectionSelector } from '../api-tester/DatabaseCollectionSelector';
import { MessageTemplateEditor } from './components/MessageTemplateEditor';
import { KafkaConnectionForm } from './components/KafkaConnectionForm';
import { MessageFieldMapper } from './components/MessageFieldMapper';
import { TestExecutor } from './components/TestExecutor';

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
  // Security configuration
  securityProtocol?: 'PLAINTEXT' | 'SSL' | 'SASL_PLAINTEXT' | 'SASL_SSL';
  saslMechanism?: 'PLAIN' | 'SCRAM-SHA-256' | 'SCRAM-SHA-512' | 'GSSAPI';
  // SSL/TLS configuration
  ssl?: {
    caLocation?: string;
    certLocation?: string;
    keyLocation?: string;
    keyPassword?: string;
  };
  // Kerberos configuration
  kerberos?: {
    keytabLocation?: string;
    krb5ConfigLocation?: string;
    serviceName?: string;
    principal?: string;
  };
  // SASL configuration
  sasl?: {
    username?: string;
    password?: string;
  };
}

interface MappingInfo {
  targetField: string;
  type: 'mongodb' | 'fixed' | 'special';
  value?: string;
}

interface MessageTemplate {
  rawTemplate: string;
  parsedTemplate: {
    key?: string;
    value: any;
    headers?: Record<string, string>;
  };
}

interface TestConfig {
  numberOfMessages: number;
  messagesPerSecond: number;
  batchSize: number;
  isAsync: boolean;
}

interface KafkaTesterState {
  step: number;
  connectionConfig: ConnectionConfig;
  kafkaConfig: KafkaConfig;
  messageTemplate: MessageTemplate;
  mappedFields: Record<string, MappingInfo>;
  testConfig: TestConfig;
  availableFields: string[];
}

const DEFAULT_STATE: KafkaTesterState = {
  step: 1,
  connectionConfig: {
    connectionString: '',
    database: undefined,
    collection: undefined,
    query: undefined
  },
  kafkaConfig: {
    brokers: ['localhost:9092'],
    clientId: 'kafka-performance-tester',
    topic: undefined,
    securityProtocol: 'PLAINTEXT',
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
  },
  messageTemplate: {
    rawTemplate: JSON.stringify({
      key: "{{_id}}",
      value: {
        id: "{{_id}}",
        timestamp: "{{timestamp}}",
        data: "{{$data}}"
      },
      headers: {
        "source": "mongodb",
        "timestamp": "{{timestamp}}"
      }
    }, null, 2),
    parsedTemplate: {
      key: "{{_id}}",
      value: {
        id: "{{_id}}",
        timestamp: "{{timestamp}}",
        data: "{{$data}}"
      },
      headers: {
        "source": "mongodb",
        "timestamp": "{{timestamp}}"
      }
    }
  },
  mappedFields: {},
  testConfig: {
    numberOfMessages: 1000,
    messagesPerSecond: 100,
    batchSize: 10,
    isAsync: true
  },
  availableFields: []
};

const STEPS = [
  { number: 1, title: 'Kafka Setup', description: 'Configure Kafka producer' },
  { number: 2, title: 'Connect', description: 'Configure MongoDB connection' },
  { number: 3, title: 'Select Data', description: 'Choose database and collection' },
  { number: 4, title: 'Message Template', description: 'Define Kafka message structure' },
  { number: 5, title: 'Map Fields', description: 'Map MongoDB fields to message template' },
  { number: 6, title: 'Execute', description: 'Run performance tests' },
];

const KafkaTester: React.FC<BaseToolProps> = (props) => {
  const { state, setState } = useToolState({
    initialState: DEFAULT_STATE,
    ...props
  });

  // Ensure we always have a valid step
  useEffect(() => {
    if (state && (!state.step || state.step < 1 || state.step > STEPS.length)) {
      setState({ step: 1 });
    }
  }, [state?.step, setState]);

  // If state is not initialized yet, show loading
  if (!state) {
    return <div>Loading...</div>;
  }

  const currentStep = STEPS.find(s => s.number === state.step) || STEPS[0];

  // Helper function to extract fields from document (reused from API tester)
  const extractDocumentFields = useCallback((doc: any): string[] => {
    const fields: string[] = [];

    const processValue = (value: any, path: string = '') => {
      if (value === null || value === undefined) {
        return;
      }

      // Handle ObjectId
      if (value && typeof value === 'object' && value._bsontype === 'ObjectID') {
        fields.push(path ? `${path}.toString()` : 'toString()');
        return;
      }

      // Handle Buffer
      if (value && typeof value === 'object' && value.buffer) {
        fields.push(path ? `${path}.toString()` : 'toString()');
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          processValue(item, path ? `${path}[${index}]` : `[${index}]`);
        });
      } else if (typeof value === 'object') {
        Object.entries(value).forEach(([key, val]) => {
          const newPath = path ? `${path}.${key}` : key;
          processValue(val, newPath);
        });
      } else {
        fields.push(path);
      }
    };

    processValue(doc);
    return fields;
  }, []);

  const handleKafkaConnectionSubmit = useCallback((config: KafkaConfig) => {
    setState({
      kafkaConfig: config,
      step: 2
    });
  }, [setState]);

  const handleConnectionSubmit = useCallback((config: ConnectionConfig) => {
    setState({
      connectionConfig: config,
      step: 3
    });
  }, [setState]);

  const handleDatabaseSelect = useCallback(async (db: string, collection: string, query?: string) => {
    if (!state) return;

    const newConnectionConfig = {
      ...state.connectionConfig,
      database: db,
      collection: collection,
      query: query
    };

    try {
      const batchResult = await window.electronAPI.mongodb.initializeBatch({
        database: db,
        collection: collection,
        query: query ? JSON.parse(query) : undefined,
        batchSize: 1
      });

      if (!batchResult.success || !batchResult.batchId) {
        throw new Error(batchResult.error || 'Failed to initialize batch');
      }

      const docResult = await window.electronAPI.mongodb.getNextDocument(batchResult.batchId);
      if (!docResult.success || !docResult.document) {
        throw new Error(docResult.error || 'Failed to fetch sample document');
      }

      await window.electronAPI.mongodb.closeBatch(batchResult.batchId);

      const fields = extractDocumentFields(docResult.document);
      setState({
        connectionConfig: newConnectionConfig,
        availableFields: fields,
        step: 4
      });
    } catch (error) {
      console.error('Failed to fetch sample document:', error);
    }
  }, [state, setState, extractDocumentFields]);

  const handleTemplateChange = useCallback((template: MessageTemplate) => {
    setState({
      messageTemplate: template,
      step: 5
    });
  }, [setState]);

  const handleFieldMap = useCallback((mappedFields: Record<string, MappingInfo>, updatedTemplate: MessageTemplate) => {
    setState({
      mappedFields,
      messageTemplate: updatedTemplate,
      step: 6
    });
  }, [setState]);

  const handleStepBack = useCallback((step: number) => {
    setState({ ...state, step });
  }, [state, setState]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-2">
            {STEPS.map((s) => (
              <div key={s.number} className="flex items-center">
                <div
                  onClick={() => {
                    // Only allow going back to previous steps
                    if (s.number < state.step) {
                      handleStepBack(s.number);
                    }
                  }}
                  className={`
                    flex items-center justify-center w-10 h-10 rounded-full font-semibold text-sm
                    transition-all duration-200 ease-in-out cursor-pointer
                    ${state.step === s.number
                      ? 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-gray-900'
                      : state.step > s.number
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }
                    ${s.number < state.step ? 'hover:bg-blue-500' : 'cursor-not-allowed'}
                  `}
                >
                  {state.step > s.number ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    s.number
                  )}
                </div>
                {s.number < STEPS.length && (
                  <div className={`w-16 h-1 mx-1 rounded-full transition-colors duration-200
                    ${state.step > s.number
                      ? 'bg-green-500'
                      : 'bg-gray-200 dark:bg-gray-700'}`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center mt-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {currentStep.title}
            </h2>
            <span className="mx-2 text-gray-500 dark:text-gray-400">—</span>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {currentStep.description}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 transition-colors duration-200">
          {state.step === 1 && (
            <KafkaConnectionForm
              defaultConfig={state.kafkaConfig || {
                brokers: ['localhost:9092'],
                clientId: 'kafka-performance-tester',
                topic: undefined,
                securityProtocol: 'PLAINTEXT',
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
              }}
              onSubmit={handleKafkaConnectionSubmit}
            />
          )}

          {state.step === 2 && (
            <MongoDBConnectionForm
              defaultConnectionString={state.connectionConfig?.connectionString || ''}
              onSubmit={handleConnectionSubmit}
              onBack={() => handleStepBack(1)}
            />
          )}

          {state.step === 3 && (
            <DatabaseCollectionSelector
              connectionConfig={state.connectionConfig}
              onSelect={handleDatabaseSelect}
              onBack={() => handleStepBack(2)}
            />
          )}

          {state.step === 4 && (
            <MessageTemplateEditor
              template={state.messageTemplate || { rawTemplate: '', parsedTemplate: {} }}
              availableFields={state.availableFields || []}
              onTemplateChange={handleTemplateChange}
              onBack={() => handleStepBack(3)}
            />
          )}

          {state.step === 5 && (
            <MessageFieldMapper
              template={state.messageTemplate || { rawTemplate: '', parsedTemplate: {} }}
              connectionConfig={state.connectionConfig}
              availableFields={state.availableFields || []}
              onMap={handleFieldMap}
              onBack={() => handleStepBack(4)}
            />
          )}

          {state.step === 6 && (
            <TestExecutor
              connectionConfig={state.connectionConfig}
              kafkaConfig={state.kafkaConfig || {
                brokers: ['localhost:9092'],
                clientId: 'kafka-performance-tester',
                topic: undefined,
                securityProtocol: 'PLAINTEXT',
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
              }}
              messageTemplate={state.messageTemplate || { rawTemplate: '', parsedTemplate: {} }}
              mappedFields={state.mappedFields}
              testConfig={state.testConfig || {
                numberOfMessages: 1000,
                messagesPerSecond: 100,
                batchSize: 10,
                isAsync: true
              }}
              onConfigChange={(newTestConfig) => setState({ testConfig: newTestConfig })}
              onBack={() => handleStepBack(5)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default KafkaTester;