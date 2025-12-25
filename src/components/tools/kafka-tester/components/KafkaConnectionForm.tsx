import React, { useState, useCallback } from 'react';
import { ChevronLeftIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface KafkaConfig {
  brokers: string[];
  clientId: string;
  topic?: string;
  groupId?: string;
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

interface KafkaConnectionFormProps {
  defaultConfig: KafkaConfig;
  onSubmit: (config: KafkaConfig) => void;
  onBack?: () => void;
}

export const KafkaConnectionForm: React.FC<KafkaConnectionFormProps> = ({
  defaultConfig,
  onSubmit,
  onBack
}) => {
  const [config, setConfig] = useState<KafkaConfig>(defaultConfig || {
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
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [topics, setTopics] = useState<string[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    try {
      // Test connection and get topics
      const result = await window.electronAPI.connectToKafka(config);

      if (result.success) {
        const topicsResult = await window.electronAPI.listKafkaTopics();
        if (topicsResult.success) {
          setTopics(topicsResult.topics || []);
        }
        onSubmit(config);
      } else {
        throw new Error(result.error || 'Failed to connect to Kafka');
      }
    } catch (error) {
      console.error('Kafka connection failed:', error);
      // Still allow continuation even if connection test fails
      onSubmit(config);
    } finally {
      setIsConnecting(false);
    }
  }, [config, onSubmit]);

  const handleFieldChange = useCallback((field: keyof KafkaConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleNestedFieldChange = useCallback((parentField: 'ssl' | 'kerberos' | 'sasl', field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [parentField]: {
        ...prev[parentField],
        [field]: value
      }
    }));
  }, []);

  const loadTopics = useCallback(async () => {
    setIsLoadingTopics(true);
    try {
      const result = await window.electronAPI.connectToKafka(config);
      if (result.success) {
        const topicsResult = await window.electronAPI.listKafkaTopics();
        if (topicsResult.success) {
          setTopics(topicsResult.topics || []);
        }
      }
    } catch (error) {
      console.error('Failed to load topics:', error);
    } finally {
      setIsLoadingTopics(false);
    }
  }, [config]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {onBack ? (
          <button
            onClick={onBack}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5 mr-2" />
            Back
          </button>
        ) : (
          <div className="w-24"></div> // Spacer to keep title centered if no back button
        )}

        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Configure Kafka Producer
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Set up Kafka connection and target topic for message production
          </p>
        </div>

        <div className="w-16"></div> {/* Spacer for alignment */}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Configuration */}
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
            Basic Configuration
          </h4>

          <div>
            <label htmlFor="brokers" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Bootstrap Servers
              <div className="group relative inline-block ml-2">
                <InformationCircleIcon className="w-4 h-4 text-gray-400" />
                <div className="hidden group-hover:block absolute z-10 w-48 px-2 py-1 text-xs text-white bg-gray-900 rounded-md -right-1 transform translate-x-full">
                  Comma-separated list of Kafka brokers (e.g., localhost:9092)
                </div>
              </div>
            </label>
            <input
              type="text"
              id="brokers"
              value={config.brokers.join(',')}
              onChange={(e) => handleFieldChange('brokers', e.target.value.split(',').map(b => b.trim()))}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
              placeholder="localhost:9092"
              required
            />
          </div>

          <div>
            <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Client ID
              <div className="group relative inline-block ml-2">
                <InformationCircleIcon className="w-4 h-4 text-gray-400" />
                <div className="hidden group-hover:block absolute z-10 w-48 px-2 py-1 text-xs text-white bg-gray-900 rounded-md -right-1 transform translate-x-full">
                  Unique identifier for this producer client
                </div>
              </div>
            </label>
            <input
              type="text"
              id="clientId"
              value={config.clientId}
              onChange={(e) => handleFieldChange('clientId', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
              placeholder="kafka-performance-tester"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="topic" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Target Topic
                <div className="group relative inline-block ml-2">
                  <InformationCircleIcon className="w-4 h-4 text-gray-400" />
                  <div className="hidden group-hover:block absolute z-10 w-48 px-2 py-1 text-xs text-white bg-gray-900 rounded-md -right-1 transform translate-x-full">
                    The Kafka topic where messages will be produced
                  </div>
                </div>
              </label>
              <button
                type="button"
                onClick={loadTopics}
                disabled={isLoadingTopics}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50"
              >
                {isLoadingTopics ? 'Loading...' : 'Load Topics'}
              </button>
            </div>

            {topics.length > 0 ? (
              <select
                id="topic"
                value={config.topic || ''}
                onChange={(e) => handleFieldChange('topic', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                required
              >
                <option value="">Select a topic...</option>
                {topics.map(topic => (
                  <option key={topic} value={topic}>{topic}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                id="topic"
                value={config.topic || ''}
                onChange={(e) => handleFieldChange('topic', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                placeholder="my-performance-topic"
                required
              />
            )}
          </div>
        </div>

        {/* Security Configuration */}
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
            Security Configuration
          </h4>

          <div>
            <label htmlFor="securityProtocol" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Security Protocol
            </label>
            <select
              id="securityProtocol"
              value={config.securityProtocol}
              onChange={(e) => handleFieldChange('securityProtocol', e.target.value as KafkaConfig['securityProtocol'])}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
            >
              <option value="PLAINTEXT">PLAINTEXT</option>
              <option value="SSL">SSL</option>
              <option value="SASL_PLAINTEXT">SASL_PLAINTEXT</option>
              <option value="SASL_SSL">SASL_SSL</option>
            </select>
          </div>

          {(config.securityProtocol === 'SASL_PLAINTEXT' || config.securityProtocol === 'SASL_SSL') && (
            <div className="space-y-4 pl-4 border-l-2 border-blue-200 dark:border-blue-700">
              <div>
                <label htmlFor="saslMechanism" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  SASL Mechanism
                </label>
                <select
                  id="saslMechanism"
                  value={config.saslMechanism || ''}
                  onChange={(e) => handleFieldChange('saslMechanism', e.target.value as KafkaConfig['saslMechanism'])}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                >
                  <option value="">Select mechanism</option>
                  <option value="PLAIN">PLAIN</option>
                  <option value="SCRAM-SHA-256">SCRAM-SHA-256</option>
                  <option value="SCRAM-SHA-512">SCRAM-SHA-512</option>
                  <option value="GSSAPI">GSSAPI (Kerberos)</option>
                </select>
              </div>

              {(config.saslMechanism === 'PLAIN' || config.saslMechanism === 'SCRAM-SHA-256' || config.saslMechanism === 'SCRAM-SHA-512') && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="saslUsername" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Username
                    </label>
                    <input
                      type="text"
                      id="saslUsername"
                      value={config.sasl?.username || ''}
                      onChange={(e) => handleNestedFieldChange('sasl', 'username', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="saslPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Password
                    </label>
                    <input
                      type="password"
                      id="saslPassword"
                      value={config.sasl?.password || ''}
                      onChange={(e) => handleNestedFieldChange('sasl', 'password', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {(config.securityProtocol === 'SSL' || config.securityProtocol === 'SASL_SSL') && (
            <div className="space-y-4 pl-4 border-l-2 border-green-200 dark:border-green-700">
              <div>
                <label htmlFor="caLocation" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  CA Certificate Location
                </label>
                <input
                  type="text"
                  id="caLocation"
                  value={config.ssl?.caLocation || ''}
                  onChange={(e) => handleNestedFieldChange('ssl', 'caLocation', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                  placeholder="/path/to/ca.pem"
                />
              </div>

              <div>
                <label htmlFor="certLocation" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Client Certificate Location
                </label>
                <input
                  type="text"
                  id="certLocation"
                  value={config.ssl?.certLocation || ''}
                  onChange={(e) => handleNestedFieldChange('ssl', 'certLocation', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                  placeholder="/path/to/cert.pem"
                />
              </div>

              <div>
                <label htmlFor="keyLocation" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Client Key Location
                </label>
                <input
                  type="text"
                  id="keyLocation"
                  value={config.ssl?.keyLocation || ''}
                  onChange={(e) => handleNestedFieldChange('ssl', 'keyLocation', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                  placeholder="/path/to/key.pem"
                />
              </div>

              <div>
                <label htmlFor="keyPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Key Password (if encrypted)
                </label>
                <input
                  type="password"
                  id="keyPassword"
                  value={config.ssl?.keyPassword || ''}
                  onChange={(e) => handleNestedFieldChange('ssl', 'keyPassword', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="submit"
            disabled={isConnecting}
            className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isConnecting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              </>
            ) : (
              'Continue to Field Mapping'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};