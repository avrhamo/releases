import React, { useState, useCallback, useEffect } from 'react';
import { ChevronLeftIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import MonacoEditor from '../../../../common/editor/MonacoEditor';
import { useTheme } from '../../../../hooks/useTheme';

interface ConnectionConfig {
  connectionString: string;
  database?: string;
  collection?: string;
  query?: string;
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

interface MessageFieldMapperProps {
  template: MessageTemplate;
  connectionConfig: ConnectionConfig;
  availableFields: string[];
  onMap: (mappedFields: Record<string, MappingInfo>, updatedTemplate: MessageTemplate) => void;
  onBack: () => void;
}

export const MessageFieldMapper: React.FC<MessageFieldMapperProps> = ({
  template,
  connectionConfig,
  availableFields,
  onMap,
  onBack
}) => {
  const { theme } = useTheme();
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, MappingInfo>>({});
  const [previewTemplate, setPreviewTemplate] = useState('');
  const [sampleDocument, setSampleDocument] = useState<any>(null);

  // Extract placeholders from template
  useEffect(() => {
    const extractPlaceholders = (obj: any, parentKey = ''): string[] => {
      const found: string[] = [];

      if (typeof obj === 'string') {
        const matches = obj.match(/\{\{([^}]+)\}\}/g);
        if (matches) {
          found.push(...matches.map(match => match.slice(2, -2)));
        }
      } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          found.push(...extractPlaceholders(item, `${parentKey}[${index}]`));
        });
      } else if (typeof obj === 'object' && obj !== null) {
        Object.entries(obj).forEach(([key, value]) => {
          const fullKey = parentKey ? `${parentKey}.${key}` : key;
          found.push(...extractPlaceholders(value, fullKey));
        });
      }

      return found;
    };

    try {
      const uniquePlaceholders = [...new Set(extractPlaceholders(template.parsedTemplate))];
      setPlaceholders(uniquePlaceholders);

      // Initialize mappings with smart defaults
      const initialMappings: Record<string, MappingInfo> = {};
      uniquePlaceholders.forEach(placeholder => {
        if (placeholder === 'timestamp') {
          initialMappings[placeholder] = {
            targetField: placeholder,
            type: 'special',
            value: 'current_timestamp'
          };
        } else if (placeholder === '$document') {
          initialMappings[placeholder] = {
            targetField: placeholder,
            type: 'special',
            value: 'full_document'
          };
        } else if (availableFields.includes(placeholder)) {
          initialMappings[placeholder] = {
            targetField: placeholder,
            type: 'mongodb',
            value: placeholder
          };
        } else {
          initialMappings[placeholder] = {
            targetField: placeholder,
            type: 'fixed',
            value: ''
          };
        }
      });
      setMappings(initialMappings);
    } catch (error) {
      console.error('Failed to extract placeholders:', error);
    }
  }, [template.parsedTemplate, availableFields]);

  // Fetch sample document for preview
  useEffect(() => {
    const fetchSampleDocument = async () => {
      if (!connectionConfig.database || !connectionConfig.collection) return;

      try {
        const batchResult = await window.electronAPI.mongodb.initializeBatch({
          database: connectionConfig.database,
          collection: connectionConfig.collection,
          query: connectionConfig.query ? JSON.parse(connectionConfig.query) : undefined,
          batchSize: 1
        });

        if (batchResult.success && batchResult.batchId) {
          const docResult = await window.electronAPI.mongodb.getNextDocument(batchResult.batchId);
          if (docResult.success && docResult.document) {
            setSampleDocument(docResult.document);
          }
          await window.electronAPI.mongodb.closeBatch(batchResult.batchId);
        }
      } catch (error) {
        console.error('Failed to fetch sample document:', error);
      }
    };

    fetchSampleDocument();
  }, [connectionConfig]);

  // Generate preview template
  useEffect(() => {
    try {
      const generatePreview = (obj: any): any => {
        if (typeof obj === 'string') {
          let result = obj;
          placeholders.forEach(placeholder => {
            const mapping = mappings[placeholder];
            if (mapping) {
              let previewValue = '';

              switch (mapping.type) {
                case 'mongodb':
                  if (sampleDocument && mapping.value) {
                    previewValue = getNestedValue(sampleDocument, mapping.value) || `[${mapping.value}]`;
                  } else {
                    previewValue = `[${mapping.value}]`;
                  }
                  break;
                case 'fixed':
                  previewValue = mapping.value || `[fixed:${placeholder}]`;
                  break;
                case 'special':
                  if (mapping.value === 'current_timestamp') {
                    previewValue = new Date().toISOString();
                  } else if (mapping.value === 'full_document') {
                    previewValue = sampleDocument ? JSON.stringify(sampleDocument) : '[full document]';
                  } else if (mapping.value === 'base64_json') {
                    previewValue = sampleDocument ? btoa(JSON.stringify(sampleDocument)) : '[base64_json]';
                  } else {
                    previewValue = `[special:${mapping.value}]`;
                  }
                  break;
              }

              result = result.replace(new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g'), previewValue);
            }
          });
          return result;
        } else if (Array.isArray(obj)) {
          return obj.map(generatePreview);
        } else if (typeof obj === 'object' && obj !== null) {
          const result: any = {};
          Object.entries(obj).forEach(([key, value]) => {
            result[key] = generatePreview(value);
          });
          return result;
        }

        return obj;
      };

      const preview = generatePreview(template.parsedTemplate);
      setPreviewTemplate(JSON.stringify(preview, null, 2));
    } catch (error) {
      setPreviewTemplate('Error generating preview');
    }
  }, [template.parsedTemplate, mappings, sampleDocument, placeholders]);

  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => {
      if (current && typeof current === 'object') {
        if (key.includes('[') && key.includes(']')) {
          const arrayKey = key.substring(0, key.indexOf('['));
          const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
          return current[arrayKey] && current[arrayKey][index];
        }
        return current[key];
      }
      return undefined;
    }, obj);
  };

  const handleMappingChange = useCallback((placeholder: string, field: keyof MappingInfo, value: any) => {
    setMappings(prev => ({
      ...prev,
      [placeholder]: {
        ...prev[placeholder],
        [field]: value
      }
    }));
  }, []);

  const handleContinue = useCallback(() => {
    onMap(mappings, template);
  }, [mappings, template, onMap]);

  const isValid = placeholders.every(placeholder => {
    const mapping = mappings[placeholder];
    return mapping && (
      (mapping.type === 'mongodb' && mapping.value) ||
      (mapping.type === 'fixed') ||
      (mapping.type === 'special' && mapping.value)
    );
  });

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
            Map Template Fields
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configure how MongoDB data maps to message template placeholders
          </p>
        </div>

        <div className="w-16"></div> {/* Spacer for alignment */}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Field Mappings */}
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-900 dark:text-white">
            Field Mappings ({placeholders.length})
          </h4>

          {placeholders.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No placeholders found in template
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {placeholders.map((placeholder) => {
                const mapping = mappings[placeholder];
                return (
                  <div
                    key={placeholder}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <code className="text-sm font-mono bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                        {`{{${placeholder}}}`}
                      </code>
                      <div className="group relative">
                        <InformationCircleIcon className="w-4 h-4 text-gray-400" />
                        <div className="hidden group-hover:block absolute z-10 w-48 px-2 py-1 text-xs text-white bg-gray-900 rounded-md right-0 transform translate-x-full">
                          This placeholder will be replaced with the mapped value in each message
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Source Type
                        </label>
                        <select
                          value={mapping?.type || ''}
                          onChange={(e) => handleMappingChange(placeholder, 'type', e.target.value)}
                          className="block w-full text-sm rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          aria-label={`Source type for ${placeholder}`}
                        >
                          <option value="">Select source...</option>
                          <option value="mongodb">MongoDB Field</option>
                          <option value="fixed">Fixed Value</option>
                          <option value="special">Special Value</option>
                        </select>
                      </div>

                      {mapping?.type === 'mongodb' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            MongoDB Field
                          </label>
                          <select
                            value={mapping.value || ''}
                            onChange={(e) => handleMappingChange(placeholder, 'value', e.target.value)}
                            className="block w-full text-sm rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            aria-label={`MongoDB field for ${placeholder}`}
                          >
                            <option value="">Select field...</option>
                            {availableFields.map(field => (
                              <option key={field} value={field}>{field}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {mapping?.type === 'fixed' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Fixed Value
                          </label>
                          <input
                            type="text"
                            value={mapping.value || ''}
                            onChange={(e) => handleMappingChange(placeholder, 'value', e.target.value)}
                            className="block w-full text-sm rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            placeholder="Enter fixed value..."
                          />
                        </div>
                      )}

                      {mapping?.type === 'special' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Special Value
                          </label>
                          <select
                            value={mapping.value || ''}
                            onChange={(e) => handleMappingChange(placeholder, 'value', e.target.value)}
                            className="block w-full text-sm rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            aria-label={`Special value for ${placeholder}`}
                          >
                            <option value="">Select special value...</option>
                            <option value="current_timestamp">Current Timestamp</option>
                            <option value="full_document">Full MongoDB Document</option>
                            <option value="random_uuid">Random UUID</option>
                            <option value="message_index">Message Index</option>
                            <option value="base64_json">Base64 Encoded JSON (Document)</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-900 dark:text-white">
            Message Preview
          </h4>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sample MongoDB Document
              </label>
              <div className="border rounded-md overflow-hidden">
                <MonacoEditor
                  value={sampleDocument ? JSON.stringify(sampleDocument, null, 2) : 'No sample document available'}
                  readOnly
                  language="json"
                  height="200px"
                  theme={theme === 'dark' ? 'vs-dark' : 'light'}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Generated Kafka Message
              </label>
              <div className="border rounded-md overflow-hidden">
                <MonacoEditor
                  value={previewTemplate}
                  readOnly
                  language="json"
                  height="300px"
                  theme={theme === 'dark' ? 'vs-dark' : 'light'}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleContinue}
          disabled={!isValid}
          className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Continue to Test Execution
          <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}; 