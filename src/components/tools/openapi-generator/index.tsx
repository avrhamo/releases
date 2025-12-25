import React, { useEffect, useState, useCallback } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import './swagger-ui-overrides.css';
import CodeEditor from '../../common/editor/MonacoEditor';
import { useTheme } from '../../../hooks/useTheme';
import yaml from 'js-yaml'; // Changed from import * as yaml

type InputFormat = 'json' | 'yaml';

interface OpenAPIState {
  apiDefinition: string;
  generatedSpec: any;
  error: string | null;
  isFullSpec?: boolean;
  inputFormat?: InputFormat;
}

interface Props {
  state: OpenAPIState;
  setState: (state: Partial<OpenAPIState>) => void;
}

function isFullOpenAPISpec(obj: any): boolean {
  return (
    obj &&
    (typeof obj === 'object') &&
    (typeof obj.openapi === 'string' || typeof obj.swagger === 'string') &&
    obj.paths && typeof obj.paths === 'object'
  );
}

/**
 * Detects whether the input string is JSON or YAML format
 */
function detectFormat(input: string): InputFormat {
  const trimmed = input.trim();
  if (!trimmed) return 'json';

  // If it starts with { or [, it's likely JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Could be malformed JSON, try YAML
    }
  }

  // Try parsing as YAML - YAML is a superset of JSON, so valid JSON is also valid YAML
  // But if it doesn't look like JSON, treat it as YAML
  return 'yaml';
}

/**
 * Parses the input string as either JSON or YAML
 */
function parseInput(input: string, format?: InputFormat): { parsed: any; detectedFormat: InputFormat } {
  const detectedFormat = format || detectFormat(input);

  if (detectedFormat === 'json') {
    try {
      const parsed = JSON.parse(input);
      return { parsed, detectedFormat: 'json' };
    } catch (jsonError) {
      // If JSON parsing fails, try YAML as fallback
      try {
        const parsed = yaml.load(input);
        return { parsed, detectedFormat: 'yaml' };
      } catch (yamlError) {
        throw new Error('Invalid JSON format: ' + (jsonError as Error).message);
      }
    }
  } else {
    try {
      const parsed = yaml.load(input);
      return { parsed, detectedFormat: 'yaml' };
    } catch (yamlError) {
      // If YAML parsing fails, try JSON as fallback
      try {
        const parsed = JSON.parse(input);
        return { parsed, detectedFormat: 'json' };
      } catch (jsonError) {
        throw new Error('Invalid YAML format: ' + (yamlError as Error).message);
      }
    }
  }
}

const OpenAPIGenerator: React.FC<Props> = ({ state, setState }) => {
  const { theme } = useTheme();
  const [isFullSpec, setIsFullSpec] = useState(false);
  const [inputFormat, setInputFormat] = useState<InputFormat>(state.inputFormat || 'json');

  const generateOpenAPISpec = useCallback((apiDef: string, explicitFormat?: InputFormat): any => {
    let parsed: any;
    let detectedFormat: InputFormat;

    try {
      // Use explicit format if provided (e.g. from button click), otherwise auto-detect
      // But for useEffect loop, we want auto-detect behavior unless user locked it?
      // Actually, passing inputFormat from state allows manual override.
      const result = parseInput(apiDef, explicitFormat);
      parsed = result.parsed;
      detectedFormat = result.detectedFormat;

      // Update format UI if auto-detected format differs from current state
      // We do this check to avoid infinite loops, only update if different
      if (!explicitFormat && detectedFormat !== inputFormat) {
        // Side-effects in render/callback are risky. 
        // But this is called from useEffect, so setInputFormat is fine.
        setInputFormat(detectedFormat);
      }
    } catch (e) {
      throw e;
    }
    if (isFullOpenAPISpec(parsed)) {
      setIsFullSpec(true);
      return parsed;
    }
    setIsFullSpec(false);
    // --- Custom definition to OpenAPI logic ---
    const spec: any = {
      openapi: '3.0.0',
      info: {
        title: 'API Documentation',
        description: '',
        version: '1.0.0',
      },
      servers: [
        {
          url: '/api',
          description: 'API Server',
        },
      ],
      paths: {},
      components: {
        schemas: {},
      },
    };
    try {
      const endpoints = parsed;
      Object.entries(endpoints).forEach(([path, methods]: [string, any]) => {
        spec.paths[path] = {};
        Object.entries(methods).forEach(([method, details]: [string, any]) => {
          const operation: any = {
            summary: details.summary || `${method.toUpperCase()} ${path}`,
            description: details.description || '',
            tags: details.tags || ['default'],
            responses: {
              '200': {
                description: 'Successful operation',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: details.response || {},
                    },
                  },
                },
              },
            },
          };
          if (details.requestBody) {
            operation.requestBody = {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: details.requestBody,
                  },
                },
              },
            };
          }
          if (details.parameters) {
            operation.parameters = details.parameters.map((param: any) => ({
              name: param.name,
              in: param.in || 'query',
              required: param.required || false,
              schema: {
                type: param.type || 'string',
              },
              description: param.description || '',
            }));
          }
          spec.paths[path][method.toLowerCase()] = operation;
        });
        Object.entries(methods).forEach(([_method, details]: [string, any]) => {
          if (details.requestBody) {
            const schemaName = `${path.split('/').pop()}Request`;
            spec.components.schemas[schemaName] = {
              type: 'object',
              properties: details.requestBody,
            };
          }
          if (details.response) {
            const schemaName = `${path.split('/').pop()}Response`;
            spec.components.schemas[schemaName] = {
              type: 'object',
              properties: details.response,
            };
          }
        });
      });
      return spec;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('Invalid API definition format');
    }
  }, [inputFormat]); // Keep dependency on inputFormat so logic uses current selection if needed

  useEffect(() => {
    if (state.apiDefinition) {
      try {
        // Pass undefined to allow auto-detection, acting as source of truth for format
        const spec = generateOpenAPISpec(state.apiDefinition);
        setState({ generatedSpec: spec, error: null, isFullSpec });
      } catch (error: unknown) {
        setState({ error: error instanceof Error ? error.message : 'An unknown error occurred', isFullSpec: false });
      }
    } else {
      setIsFullSpec(false);
      setState({ generatedSpec: null, error: null, isFullSpec: false });
    }
  }, [state.apiDefinition, generateOpenAPISpec]); // Added generateOpenAPISpec dependency

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col lg:flex-row w-full h-full overflow-hidden">
        {/* Left: Monaco Editor */}
        <div className="w-full lg:w-1/2 flex-1 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col min-h-0">
          {/* Format Toggle Buttons */}
          <div className="flex items-center gap-2 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
            <span className="text-sm text-gray-600 dark:text-gray-400 mr-2">Format:</span>
            <button
              onClick={() => setInputFormat('json')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${inputFormat === 'json'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
            >
              JSON
            </button>
            <button
              onClick={() => setInputFormat('yaml')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${inputFormat === 'yaml'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
            >
              YAML
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-500 ml-2">(auto-detected)</span>
          </div>
          <div className="flex-1 min-h-0">
            <CodeEditor
              value={state.apiDefinition}
              onChange={(val) => setState({ apiDefinition: val || '' })}
              language={inputFormat}
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              height="100%"
            />
          </div>
        </div>
        {/* Right: Swagger UI */}
        <div className="w-full lg:w-1/2 flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-colors duration-300">
            {state.error ? (
              <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-700 transition-all duration-200">
                {state.error}
              </div>
            ) : state.generatedSpec ? (
              <div className="h-full min-h-0 overflow-y-auto">
                <SwaggerUI
                  spec={state.generatedSpec}
                  docExpansion="list"
                  defaultModelsExpandDepth={-1}
                  tryItOutEnabled={true}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <p className="mb-2">No OpenAPI specification generated yet.</p>
                  <p>Enter your API definition in JSON or YAML format.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpenAPIGenerator; 