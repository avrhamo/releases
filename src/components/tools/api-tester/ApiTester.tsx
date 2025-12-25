import React, { useState, useEffect, useCallback } from 'react';
import { MongoDBConnectionForm } from './MongoDBConnectionForm';
import { DatabaseCollectionSelector } from './DatabaseCollectionSelector';
import { CurlCommandInput } from './CurlCommandInput';
import { CurlFieldMapper } from './CurlFieldMapper';
import { TestExecutor } from './TestExecutor';
import { BaseToolProps } from '../types';
import { useToolState } from '../../../hooks/useToolState';

interface ConnectionConfig {
  connectionString: string;
  database?: string;
  collection?: string;
  query?: string;
}

interface MappingInfo {
  targetField: string;
  type: 'mongodb' | 'fixed' | 'special';
  value?: string;
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
  mappedFields: Record<string, MappingInfo>;
}

interface TestConfig {
  numberOfRequests: number;
  isAsync: boolean;
  batchSize: number;
}

interface ApiTesterState {
  step: number;
  connectionConfig: ConnectionConfig;
  curlConfig: CurlConfig;
  testConfig: TestConfig;
  availableFields: string[];
}

const STEPS = [
  { number: 1, title: 'Connect', description: 'Configure MongoDB connection' },
  { number: 2, title: 'Select Data', description: 'Choose database and collection' },
  { number: 3, title: 'API Setup', description: 'Configure CURL command' },
  { number: 4, title: 'Map Fields', description: 'Map MongoDB fields to API response' },
  { number: 5, title: 'Test', description: 'Execute and monitor tests' },
];

export const ApiTester: React.FC<BaseToolProps> = (props) => {
  const { state, setState } = useToolState(props);

  // Ensure we always have a valid step
  useEffect(() => {
    if (state && (!state.step || state.step < 1 || state.step > STEPS.length)) {
      setState({ step: 1 });
    }
  }, [state?.step, setState]);

  const currentStep = state?.step ? STEPS.find(s => s.number === state.step) || STEPS[0] : STEPS[0];

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
        step: 3
      });
    } catch (error) {
      // Sample document fetch failed - this is not critical
    }
  }, [state, setState]);

  // Helper function to extract fields from document
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

  const handleConnectionSubmit = useCallback((config: ConnectionConfig) => {
    const newState = {
      ...state,
      connectionConfig: config,
      step: 2
    };
    setState(newState);
  }, [state, setState]);

  const handleCommandChange = useCallback((parsedCommand: any) => {
    if (!state) return;
    const newState = {
      ...state,
      curlConfig: {
        ...state.curlConfig,
        parsedCommand
      },
      step: 4
    };
    setState(newState);
  }, [state, setState]);

  const handleFieldMap = useCallback((mappedFields: Record<string, MappingInfo>, updatedParsedCommand: {
    rawCommand: string;
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    data?: any;
  }) => {
    if (!state) return;
    
    // Transform MappingInfo to MappedFieldConfig format
    const transformedMappedFields: Record<string, { targetField: string; type: string; isBase64Encoded?: boolean }> = {};
    Object.entries(mappedFields).forEach(([key, mappingInfo]) => {
      transformedMappedFields[key] = {
        targetField: mappingInfo.targetField,
        type: mappingInfo.type,
        isBase64Encoded: mappingInfo.isBase64Encoded
      };
    });
    
    const newState = {
      ...state,
      curlConfig: {
        parsedCommand: updatedParsedCommand,
        mappedFields: transformedMappedFields
      },
      step: 5
    };
    setState(newState);
  }, [state, setState]);

  const handleStepBack = useCallback((step: number) => {
    setState({ ...state, step });
  }, [state, setState]);

  // If state is not initialized yet, show loading
  if (!state) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
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
                  <div className={`w-24 h-1 mx-2 rounded-full transition-colors duration-200
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
            <MongoDBConnectionForm
              defaultConnectionString={state.connectionConfig.connectionString}
              onSubmit={handleConnectionSubmit}
            />
          )}
          
          {state.step === 2 && (
            <DatabaseCollectionSelector
              connectionConfig={state.connectionConfig}
              onSelect={handleDatabaseSelect}
              onBack={() => handleStepBack(1)}
            />
          )}

          {state.step === 3 && (
            <CurlCommandInput
              initialCommand={state.curlConfig.parsedCommand.rawCommand}
              onCommandChange={handleCommandChange}
              availableFields={state.availableFields}
              onBack={() => handleStepBack(2)}
            />
          )}

          {state.step === 4 && (
            <CurlFieldMapper
              parsedCommand={state.curlConfig.parsedCommand}
              connectionConfig={state.connectionConfig}
              onMap={handleFieldMap}
              onBack={() => handleStepBack(3)}
            />
          )}

          {state.step === 5 && (
            <TestExecutor
              connectionConfig={state.connectionConfig}
              curlConfig={state.curlConfig}
              testConfig={state.testConfig}
              onConfigChange={(newTestConfig) => setState({ testConfig: newTestConfig })}
              onConnectionConfigChange={(newConnectionConfig) => setState({ connectionConfig: newConnectionConfig })}
              onCurlConfigChange={(newCurlConfig) => setState({ curlConfig: newCurlConfig })}
              onBack={() => handleStepBack(4)}
            />
          )}
        </div>
      </div>
    </div>
  );
};