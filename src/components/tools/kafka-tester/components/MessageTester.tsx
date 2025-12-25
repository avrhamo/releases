import React, { useState, useCallback, useEffect } from 'react';
import { ChevronLeftIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import MonacoEditor from '../../../../common/editor/MonacoEditor';
import { useTheme } from '../../../../hooks/useTheme';

interface KafkaConfig {
  brokers: string[];
  clientId: string;
  topic?: string;
  groupId?: string;
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

interface MessageConfig {
  key?: string;
  value: string;
  headers?: Record<string, string>;
}

interface Message {
  topic: string;
  partition: number;
  offset: string;
  key?: string;
  value?: string;
  headers?: Record<string, string>;
  timestamp: string;
}

interface MessageTesterProps {
  config: KafkaConfig;
  messageConfig: MessageConfig;
  messages: Message[];
  consumerId?: string;
  onMessageConfigChange: (messageConfig: MessageConfig) => void;
  onMessagesUpdate: (messages: Message[]) => void;
  onConsumerIdUpdate: (consumerId?: string) => void;
  onBack: () => void;
}

export const MessageTester: React.FC<MessageTesterProps> = ({
  config,
  messageConfig,
  messages,
  consumerId,
  onMessageConfigChange,
  onMessagesUpdate,
  onConsumerIdUpdate,
  onBack
}) => {
  const { theme } = useTheme();
  const [isProducing, setIsProducing] = useState(false);
  const [isConsuming, setIsConsuming] = useState(false);
  const [consumerConfig, setConsumerConfig] = useState({
    groupId: config.groupId || 'kafka-tester-group',
    fromBeginning: true,
    maxMessages: 100
  });
  const [headersInput, setHeadersInput] = useState('');

  // Update headers when input changes
  useEffect(() => {
    try {
      const headers = headersInput.trim() ? JSON.parse(headersInput) : undefined;
      onMessageConfigChange({
        ...messageConfig,
        headers
      });
    } catch (error) {
      // Invalid JSON, keep existing headers
    }
  }, [headersInput]);

  // Initialize headers input
  useEffect(() => {
    if (messageConfig.headers) {
      setHeadersInput(JSON.stringify(messageConfig.headers, null, 2));
    }
  }, []);

  const handleProduce = useCallback(async () => {
    if (!config.topic) {
      return;
    }

    setIsProducing(true);
    try {
      const result = await window.electronAPI.produceKafkaMessage({
        topic: config.topic,
        messages: [messageConfig],
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to produce message');
      }
    } catch (error) {
      console.error('Failed to produce message:', error);
      throw error;
    } finally {
      setIsProducing(false);
    }
  }, [config.topic, messageConfig]);

  const handleConsume = useCallback(async () => {
    if (!config.topic || !consumerConfig.groupId) {
      return;
    }

    setIsConsuming(true);
    try {
      const result = await window.electronAPI.consumeKafkaMessages({
        topic: config.topic,
        groupId: consumerConfig.groupId,
        fromBeginning: consumerConfig.fromBeginning,
        maxMessages: consumerConfig.maxMessages,
      });

      if (result.success) {
        onMessagesUpdate(result.messages || []);
        onConsumerIdUpdate(result.consumerId);
      } else {
        throw new Error(result.error || 'Failed to consume messages');
      }
    } catch (error) {
      console.error('Failed to consume messages:', error);
      throw error;
    } finally {
      setIsConsuming(false);
    }
  }, [config.topic, consumerConfig, onMessagesUpdate, onConsumerIdUpdate]);

  const handleStopConsumer = useCallback(async () => {
    if (!consumerId) return;

    try {
      await window.electronAPI.stopKafkaConsumer(consumerId);
      onConsumerIdUpdate(undefined);
    } catch (error) {
      console.error('Failed to stop consumer:', error);
    }
  }, [consumerId, onConsumerIdUpdate]);

  const formatTimestamp = useCallback((timestamp: string) => {
    try {
      return new Date(parseInt(timestamp)).toLocaleString();
    } catch {
      return timestamp;
    }
  }, []);

  const handleMessageValueChange = useCallback((value: string) => {
    onMessageConfigChange({
      ...messageConfig,
      value: value || ''
    });
  }, [messageConfig, onMessageConfigChange]);

  const handleKeyChange = useCallback((key: string) => {
    onMessageConfigChange({
      ...messageConfig,
      key: key || undefined
    });
  }, [messageConfig, onMessageConfigChange]);

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
            Message Testing
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Topic: <span className="font-medium">{config.topic}</span>
          </p>
        </div>

        <div className="w-16"></div> {/* Spacer for alignment */}
      </div>

      {/* Consumer Configuration */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
          Consumer Configuration
        </h4>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="groupId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Consumer Group ID
              <div className="group relative inline-block ml-2">
                <InformationCircleIcon className="w-4 h-4 text-gray-400" />
                <div className="hidden group-hover:block absolute z-10 w-48 px-2 py-1 text-xs text-white bg-gray-900 rounded-md -right-1 transform translate-x-full">
                  Unique identifier for the consumer group
                </div>
              </div>
            </label>
            <input
              type="text"
              id="groupId"
              value={consumerConfig.groupId}
              onChange={(e) => setConsumerConfig(prev => ({ ...prev, groupId: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
              placeholder="my-consumer-group"
            />
          </div>

          <div>
            <label htmlFor="maxMessages" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Max Messages
            </label>
            <input
              type="number"
              id="maxMessages"
              min="1"
              max="1000"
              value={consumerConfig.maxMessages}
              onChange={(e) => setConsumerConfig(prev => ({ ...prev, maxMessages: parseInt(e.target.value) || 100 }))}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="fromBeginning"
              checked={consumerConfig.fromBeginning}
              onChange={(e) => setConsumerConfig(prev => ({ ...prev, fromBeginning: e.target.checked }))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="fromBeginning" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Consume from beginning
            </label>
          </div>
        </div>
      </div>

      {/* Message Producer */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
          Produce Message
        </h4>

        <div className="space-y-4">
          <div>
            <label htmlFor="messageKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Key (optional)
            </label>
            <input
              type="text"
              id="messageKey"
              value={messageConfig.key || ''}
              onChange={(e) => handleKeyChange(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
              placeholder="Message key"
            />
          </div>

          <div>
            <label htmlFor="messageValue" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Value
            </label>
            <div className="mt-1">
              <MonacoEditor
                value={messageConfig.value}
                onChange={handleMessageValueChange}
                language="json"
                height="200px"
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
              />
            </div>
          </div>

          <div>
            <label htmlFor="messageHeaders" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Headers (JSON, optional)
            </label>
            <div className="mt-1">
              <MonacoEditor
                value={headersInput}
                onChange={(value) => setHeadersInput(value || '')}
                language="json"
                height="100px"
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              onClick={handleProduce}
              disabled={isProducing || !messageConfig.value.trim()}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProducing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Producing...
                </>
              ) : (
                'Produce Message'
              )}
            </button>

            <button
              onClick={consumerId ? handleStopConsumer : handleConsume}
              disabled={isConsuming}
              className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed ${consumerId
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                  : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                }`}
            >
              {isConsuming ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Consuming...
                </>
              ) : consumerId ? (
                'Stop Consumer'
              ) : (
                'Consume Messages'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Messages Display */}
      {messages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-md font-medium text-gray-900 dark:text-white">
              Consumed Messages ({messages.length})
            </h4>
            <button
              onClick={() => onMessagesUpdate([])}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              Clear Messages
            </button>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {messages.map((msg, index) => (
              <div
                key={`${msg.topic}-${msg.partition}-${msg.offset}-${index}`}
                className="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="px-4 py-5 sm:p-6">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Topic</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">{msg.topic}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Partition</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">{msg.partition}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Offset</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">{msg.offset}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Timestamp</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {formatTimestamp(msg.timestamp)}
                      </dd>
                    </div>
                    {msg.key && (
                      <div className="sm:col-span-2">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Key</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded">
                          {msg.key}
                        </dd>
                      </div>
                    )}
                    {msg.headers && Object.keys(msg.headers).length > 0 && (
                      <div className="sm:col-span-2">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Headers</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                          <MonacoEditor
                            value={JSON.stringify(msg.headers, null, 2)}
                            readOnly
                            language="json"
                            height="100px"
                            theme={theme === 'dark' ? 'vs-dark' : 'light'}
                          />
                        </dd>
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Value</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        <MonacoEditor
                          value={msg.value || ''}
                          readOnly
                          language="json"
                          height="150px"
                          theme={theme === 'dark' ? 'vs-dark' : 'light'}
                        />
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {messages.length === 0 && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No messages
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Start consuming to see messages appear here.
          </p>
        </div>
      )}
    </div>
  );
}; 