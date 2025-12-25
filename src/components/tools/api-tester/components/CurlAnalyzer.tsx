import React, { useState, useEffect, useRef, useCallback } from 'react';
import { XMarkIcon, MagnifyingGlassIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

interface CurlAnalyzerProps {
  curlCommand: string;
  onFieldMap: (field: string, mappingInfo: MappingInfo) => void;
  availableFields: string[];
  requestData?: any;
}

interface ParsedCurl {
  method: string;
  url: {
    base: string;
    pathParams: { [key: string]: string };
    queryParams: { [key: string]: string };
  };
  headers: { [key: string]: string };
  body: Record<string, unknown> | string | undefined;
}

interface PanelState {
  isOpen: boolean;
  position: { top: number; right: number; left: number; bottom: number };
  fieldPath: string;
  fieldType: string;
}

interface FixedValueConfig {
  type: 'string' | 'number' | 'boolean' | 'date';
  value: string;
  isRandom: boolean;
  regex?: string;
}

interface SpecialFieldConfig {
  type: 'uuid' | 'uuid_v4' | 'uuid_v4_short' | 'uuid_v1' | 'nanoid' | 'timestamp' | 'unix_timestamp' | 'date_only' | 'random_int' | 'random_float' | 'random_string' | 'random_email';
}

type MappingType = 'mongodb' | 'fixed' | 'special';

interface MappingPanelProps {
  isOpen: boolean;
  initialPosition: { top: number; right: number; left: number; bottom: number };
  onClose: () => void;
  availableFields: string[];
  onSelect: (field: string, config?: FixedValueConfig | SpecialFieldConfig) => void;
  fieldPath: string;
}

interface MappingInfo {
  targetField: string;
  type: 'mongodb' | 'fixed' | 'special';
  value?: string;
  isBase64Encoded?: boolean; // Track if the original field was Base64 encoded
}

interface JsonTreeProps {
  data: Record<string, unknown> | unknown[] | string;
  path?: string;
  selectedPath?: string;
  onKeyClick: (path: string, type: string, event: React.MouseEvent) => void;
  mappings?: Record<string, MappingInfo>;
}

interface Base64JsonInfo {
  isBase64Json: true;
  decodedValue: Record<string, unknown>;
}

interface NotBase64Json {
  isBase64Json: false;
  originalValue: unknown;
}

type Base64DetectionResult = Base64JsonInfo | NotBase64Json;

const ClickableKey: React.FC<{
  fieldKey: string;
  path: string;
  isDisabled?: boolean;
  onKeyClick: (path: string, type: string, event: React.MouseEvent) => void;
  mapping?: MappingInfo;
}> = ({ fieldKey, path, isDisabled = false, onKeyClick, mapping }) => (
  <div className="relative group">
      <button
      onClick={(e) => !isDisabled && onKeyClick(path, 'bodyField', e)}
      className={`
        font-mono text-sm rounded px-1.5 py-0.5 transition-colors duration-150 flex items-center
        ${isDisabled 
          ? 'text-gray-500 dark:text-gray-600 cursor-not-allowed'
          : mapping
            ? 'text-blue-500 dark:text-blue-400'
            : 'text-blue-500 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900'
        }
      `}
      aria-label={`Map field ${fieldKey}`}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
    >
      {fieldKey}
      {mapping?.isBase64Encoded && (
        <span className="ml-1 text-xs px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400" title="Base64 encoded field">
          B64
        </span>
      )}
      {mapping && (
        <>
          <div className="ml-2 h-2 w-2 rounded-full bg-green-400"></div>
          <div className="absolute z-50 bottom-full left-0 mb-1 px-2 py-1 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {mapping.type === 'mongodb' && `Mapped to: ${mapping.targetField}`}
            {mapping.type === 'fixed' && `Fixed value: ${mapping.value}`}
            {mapping.type === 'special' && 'Special: UUID'}
          </div>
        </>
      )}
    </button>
  </div>
);

const MappingPanel: React.FC<MappingPanelProps> = ({
  isOpen,
  initialPosition,
  onClose,
  availableFields,
  onSelect,
  fieldPath
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<MappingType>('mongodb');
  const [fixedValueConfig, setFixedValueConfig] = useState<FixedValueConfig>({
    type: 'string',
    value: '',
    isRandom: false
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const [positionStyle, setPositionStyle] = useState<React.CSSProperties>({});

  // Recalculate position when panel opens or initial position changes
  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (!panelRef.current) return;

      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };

      // Panel dimensions - more reasonable size
      const panelWidth = 480; 
      const panelHeight = 580; 

      // Center the panel on the viewport
      const left = Math.max(20, (viewport.width - panelWidth) / 2);
      const top = Math.max(20, (viewport.height - panelHeight) / 2);

      setPositionStyle({
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        width: `${panelWidth}px`,
        height: `${panelHeight}px`,
        maxWidth: `${Math.min(panelWidth, viewport.width - 40)}px`,
        maxHeight: `${Math.min(panelHeight, viewport.height - 40)}px`,
        zIndex: 1000,
        transform: 'none' // Ensure no transform conflicts
      });
    };

    // Initial position calculation
    requestAnimationFrame(() => {
      updatePosition();
    });

    // Update position on window resize
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [isOpen, initialPosition]);

  const handleFixedValueSubmit = () => {
    onSelect('fixedValue', fixedValueConfig);
    onClose();
  };

  const handleSpecialFieldSubmit = (type: SpecialFieldConfig['type']) => {
    onSelect('specialValue', { type });
    onClose();
  };

  const renderMongoDBTab = () => (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl opacity-0 group-focus-within:opacity-10 transition-opacity duration-300"></div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search MongoDB fields..."
          className="
            relative w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600
            text-sm bg-gray-50 dark:bg-gray-900 dark:text-white
            transition-all duration-300
            focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-20 focus:border-blue-500
            placeholder-gray-400 dark:placeholder-gray-500
          "
          aria-label="Search fields"
        />
        <MagnifyingGlassIcon className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            title="Clear search"
            className="absolute right-3 top-3.5 h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Fields List */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="max-h-[320px] overflow-y-auto">
          {filteredFields.length > 0 ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-600">
              {filteredFields.map((field, index) => (
                <button
                  key={index}
                  onClick={() => {
                    onSelect(field);
                    onClose();
                  }}
                  className="
                    w-full text-left px-4 py-3 text-sm
                    hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 
                    dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20
                    text-gray-800 dark:text-gray-200
                    transition-all duration-200 group
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset
                  "
                  aria-label={`Select field ${field}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full opacity-60 group-hover:opacity-100 transition-opacity"></div>
                    <span className="font-mono text-gray-700 dark:text-gray-300 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                      {field}
                    </span>
                    <div className="flex-1"></div>
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">No matching fields found</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try a different search term</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Field count indicator */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{filteredFields.length} field{filteredFields.length !== 1 ? 's' : ''} available</span>
        {searchTerm && (
          <span>Filtered from {availableFields.length} total</span>
        )}
      </div>
    </div>
  );

  const renderFixedValueTab = () => (
    <div className="space-y-6">
      {/* Value Type Selection */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-900 dark:text-white">
          Value Type
        </label>
        <div className="relative group">
          <select
            value={fixedValueConfig.type}
            onChange={(e) => setFixedValueConfig(prev => ({ ...prev, type: e.target.value as FixedValueConfig['type'] }))}
            className="
              w-full px-4 py-3 pr-10 rounded-xl border-2 border-gray-200 dark:border-gray-600
              text-sm bg-gray-50 dark:bg-gray-900 dark:text-white
              transition-all duration-300 appearance-none cursor-pointer
              focus:outline-none focus:ring-4 focus:ring-green-500 focus:ring-opacity-20 focus:border-green-500
            "
            aria-label="Select value type"
          >
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="date">Date</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Value Input */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-900 dark:text-white">
          Value
        </label>
        <div className="flex items-center space-x-3">
          <div className="relative group flex-1">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl opacity-0 group-focus-within:opacity-10 transition-opacity duration-300"></div>
            <input
              type={fixedValueConfig.type === 'number' ? 'number' : 'text'}
              value={fixedValueConfig.value}
              onChange={(e) => setFixedValueConfig(prev => ({ ...prev, value: e.target.value }))}
              disabled={fixedValueConfig.isRandom}
              className="
                relative w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600
                text-sm bg-gray-50 dark:bg-gray-900 dark:text-white
                transition-all duration-300
                focus:outline-none focus:ring-4 focus:ring-green-500 focus:ring-opacity-20 focus:border-green-500
                placeholder-gray-400 dark:placeholder-gray-500
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              placeholder={fixedValueConfig.isRandom ? 'Random value will be generated' : 'Enter value'}
            />
          </div>
          <button
            onClick={() => setFixedValueConfig(prev => ({ ...prev, isRandom: !prev.isRandom }))}
            className={`
              px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 transform hover:scale-105
              focus:outline-none focus:ring-4 focus:ring-opacity-50
              ${fixedValueConfig.isRandom 
                ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white focus:ring-orange-500' 
                : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white focus:ring-blue-500'
              }
            `}
          >
            {fixedValueConfig.isRandom ? 'Fixed' : 'Random'}
          </button>
        </div>
      </div>

      {/* Regex Pattern for Random Values */}
      {fixedValueConfig.isRandom && (
        <div className="space-y-3 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
          <label className="block text-sm font-semibold text-gray-900 dark:text-white">
            Regex Pattern (Optional)
          </label>
          <div className="relative group">
            <input
              type="text"
              value={fixedValueConfig.regex || ''}
              onChange={(e) => setFixedValueConfig(prev => ({ ...prev, regex: e.target.value }))}
              className="
                w-full px-4 py-3 rounded-xl border-2 border-orange-200 dark:border-orange-700
                text-sm bg-white dark:bg-gray-900 dark:text-white
                transition-all duration-300
                focus:outline-none focus:ring-4 focus:ring-orange-500 focus:ring-opacity-20 focus:border-orange-500
                placeholder-gray-400 dark:placeholder-gray-500
              "
              placeholder="Enter regex pattern for random value generation"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Example: ^[A-Z]{2}[0-9]{4}$ for patterns like AB1234
          </p>
        </div>
      )}

      {/* Apply Button */}
      <button
        onClick={handleFixedValueSubmit}
        className="
          w-full px-6 py-3 rounded-xl text-sm font-semibold
          transition-all duration-300 transform
          focus:outline-none focus:ring-4 focus:ring-green-500 focus:ring-opacity-50
          bg-gradient-to-r from-green-600 to-emerald-600 
          hover:from-green-700 hover:to-emerald-700 
          active:scale-95 hover:scale-105
          text-white shadow-lg hover:shadow-xl
        "
      >
        <div className="flex items-center justify-center space-x-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Apply Fixed Value</span>
        </div>
      </button>
    </div>
  );

  const renderSpecialFieldTab = () => (
    <div className="space-y-6">
      {/* UUID Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-blue-900 dark:text-blue-100 uppercase tracking-wide">UUID Variants</h3>
        </div>
        <div className="space-y-2">
          <button
            onClick={() => handleSpecialFieldSubmit('uuid_v4')}
            className="w-full p-3 text-left rounded-xl border border-blue-200 dark:border-blue-700 hover:bg-gradient-to-r hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-800/50 dark:hover:to-indigo-800/50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 group"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-sm text-blue-700 dark:text-blue-300 font-semibold">{"{{uuid_v4}}"}</span>
                <span className="block text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Random UUID v4 (550e8400-e29b-41d4-a716-446655440000)
                </span>
              </div>
              <svg className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
          
          <button
            onClick={() => handleSpecialFieldSubmit('uuid_v4_short')}
            className="w-full p-3 text-left rounded-xl border border-blue-200 dark:border-blue-700 hover:bg-gradient-to-r hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-800/50 dark:hover:to-indigo-800/50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 group"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-sm text-blue-700 dark:text-blue-300 font-semibold">{"{{uuid_v4_short}}"}</span>
                <span className="block text-xs text-blue-600 dark:text-blue-400 mt-1">
                  UUID v4 without hyphens
                </span>
              </div>
              <svg className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
          
          <button
            onClick={() => handleSpecialFieldSubmit('nanoid')}
            className="w-full p-3 text-left rounded-xl border border-blue-200 dark:border-blue-700 hover:bg-gradient-to-r hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-800/50 dark:hover:to-indigo-800/50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 group"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-sm text-blue-700 dark:text-blue-300 font-semibold">{"{{nanoid}}"}</span>
                <span className="block text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Short unique ID (V1StGXR8_Z5jdHi6B-myT)
                </span>
              </div>
              <svg className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>
      </div>

      {/* Timestamp Section */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-purple-900 dark:text-purple-100 uppercase tracking-wide">Timestamps</h3>
        </div>
        <div className="space-y-2">
          <button
            onClick={() => handleSpecialFieldSubmit('timestamp')}
            className="w-full p-3 text-left rounded-xl border border-purple-200 dark:border-purple-700 hover:bg-gradient-to-r hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-800/50 dark:hover:to-pink-800/50 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 group"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-sm text-purple-700 dark:text-purple-300 font-semibold">{"{{timestamp}}"}</span>
                <span className="block text-xs text-purple-600 dark:text-purple-400 mt-1">
                  Current ISO timestamp (2024-01-15T10:30:00.000Z)
                </span>
              </div>
              <svg className="w-4 h-4 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
          
          <button
            onClick={() => handleSpecialFieldSubmit('unix_timestamp')}
            className="w-full p-3 text-left rounded-xl border border-purple-200 dark:border-purple-700 hover:bg-gradient-to-r hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-800/50 dark:hover:to-pink-800/50 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 group"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-sm text-purple-700 dark:text-purple-300 font-semibold">{"{{unix_timestamp}}"}</span>
                <span className="block text-xs text-purple-600 dark:text-purple-400 mt-1">
                  Unix timestamp in milliseconds
                </span>
              </div>
              <svg className="w-4 h-4 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>
      </div>

      {/* Random Data Section */}
      <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-orange-900 dark:text-orange-100 uppercase tracking-wide">Random Data</h3>
        </div>
        <div className="space-y-2">
          <button
            onClick={() => handleSpecialFieldSubmit('random_int')}
            className="w-full p-3 text-left rounded-xl border border-orange-200 dark:border-orange-700 hover:bg-gradient-to-r hover:from-orange-100 hover:to-red-100 dark:hover:from-orange-800/50 dark:hover:to-red-800/50 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all duration-200 group"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-sm text-orange-700 dark:text-orange-300 font-semibold">{"{{random_int}}"}</span>
                <span className="block text-xs text-orange-600 dark:text-orange-400 mt-1">
                  Random integer (1-1000000)
                </span>
              </div>
              <svg className="w-4 h-4 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
          
          <button
            onClick={() => handleSpecialFieldSubmit('random_string')}
            className="w-full p-3 text-left rounded-xl border border-orange-200 dark:border-orange-700 hover:bg-gradient-to-r hover:from-orange-100 hover:to-red-100 dark:hover:from-orange-800/50 dark:hover:to-red-800/50 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all duration-200 group"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-sm text-orange-700 dark:text-orange-300 font-semibold">{"{{random_string}}"}</span>
                <span className="block text-xs text-orange-600 dark:text-orange-400 mt-1">
                  Random alphanumeric string
                </span>
              </div>
              <svg className="w-4 h-4 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
          
          <button
            onClick={() => handleSpecialFieldSubmit('random_email')}
            className="w-full p-3 text-left rounded-xl border border-orange-200 dark:border-orange-700 hover:bg-gradient-to-r hover:from-orange-100 hover:to-red-100 dark:hover:from-orange-800/50 dark:hover:to-red-800/50 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all duration-200 group"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-sm text-orange-700 dark:text-orange-300 font-semibold">{"{{random_email}}"}</span>
                <span className="block text-xs text-orange-600 dark:text-orange-400 mt-1">
                  Random email address
                </span>
              </div>
              <svg className="w-4 h-4 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  const filteredFields = availableFields.filter(field =>
    field.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Enhanced Backdrop */}
      <div 
        className="fixed inset-0 bg-gradient-to-br from-black/30 to-black/50 backdrop-blur-md z-40 animate-in fade-in duration-300" 
        aria-hidden="true"
        onClick={onClose}
      />
      
      {/* Modern Panel */}
      <div
        ref={panelRef}
        style={{
          ...positionStyle,
          maxHeight: '90vh',
        }}
        className={`
          bg-white dark:bg-gray-800 shadow-2xl border border-gray-200/50 dark:border-gray-700/50
          z-50 flex flex-col rounded-2xl overflow-hidden backdrop-blur-xl
          animate-in fade-in duration-300 slide-in-from-bottom-8 zoom-in-95
        `}
      >
        <div className="h-full flex flex-col max-h-full">
          <div className="flex-none p-6 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                    Map Field
                  </h3>
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-mono mt-0.5 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-lg">
                    {fieldPath}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close mapping panel"
                className="
                  w-10 h-10 rounded-xl bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm
                  text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 
                  hover:bg-white/80 dark:hover:bg-gray-700/80
                  transition-all duration-200 transform hover:scale-105 active:scale-95
                  focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-20
                  flex items-center justify-center
                "
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            <div className="h-full overflow-y-auto">
              <div className="px-6 pt-4 pb-2">
                <nav className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1" aria-label="Mapping options">
                  <button
                    onClick={() => setActiveTab('mongodb')}
                    className={`
                      flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-300 transform
                      ${activeTab === 'mongodb'
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg scale-105'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-600/50'
                      }
                    `}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                      </svg>
                      <span>MongoDB</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('fixed')}
                    className={`
                      flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-300 transform
                      ${activeTab === 'fixed'
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg scale-105'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-600/50'
                      }
                    `}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                      </svg>
                      <span>Fixed</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('special')}
                    className={`
                      flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-300 transform
                      ${activeTab === 'special'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg scale-105'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-600/50'
                      }
                    `}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <span>Special</span>
                    </div>
                  </button>
                </nav>
              </div>

              <div className="p-6">
                <div className="transition-all duration-300 ease-in-out">
                  {activeTab === 'mongodb' && renderMongoDBTab()}
                  {activeTab === 'fixed' && renderFixedValueTab()}
                  {activeTab === 'special' && renderSpecialFieldTab()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const tryParseBase64Json = (value: unknown): Base64DetectionResult => {
  if (typeof value !== 'string') {
    return { isBase64Json: false, originalValue: value };
  }

  try {
    // Try to decode base64
    const decodedString = atob(value);
    
    try {
      // Try to parse as JSON
      const parsedJson = JSON.parse(decodedString);
      
      // Only consider it valid if it's an object or array
      if (typeof parsedJson === 'object' && parsedJson !== null) {
        return {
          isBase64Json: true,
          decodedValue: parsedJson
        };
      }
    } catch (e) {
      // JSON parse failed, not a JSON string
    }
  } catch (e) {
    // Base64 decode failed, not a base64 string
  }

  return { isBase64Json: false, originalValue: value };
};

const JsonTree: React.FC<JsonTreeProps> = React.memo(({ 
  data, 
  path = '', 
  selectedPath, 
  onKeyClick,
  mappings = {} 
}) => {
  const isChildOfSelected = Boolean(selectedPath && path.startsWith(selectedPath + '.'));

  const renderValue = useCallback((value: unknown, key: string, fieldPath: string) => {
    // Try to detect and decode base64 JSON
    const base64Result = tryParseBase64Json(value);
    
    if (base64Result.isBase64Json) {
      return (
        <div className="flex flex-col">
          <div className="flex items-baseline py-1">
            <ClickableKey 
              fieldKey={key} 
              path={fieldPath}
              isDisabled={isChildOfSelected}
              onKeyClick={onKeyClick}
              mapping={mappings[fieldPath]}
            />
            <span className="ml-2 text-gray-400">: {`{`}</span>
            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center">
              <DocumentTextIcon className="w-3 h-3 mr-1" />
              base64
            </span>
          </div>
          <div className="ml-6 border-l-2 border-gray-700 dark:border-gray-600 pl-4">
            {Object.entries(base64Result.decodedValue).map(([k, v], index, arr) => (
              <div key={k} className="flex items-baseline">
                {renderValue(v, k, `${fieldPath}.${k}`)}
                {index < arr.length - 1 && <span className="text-gray-400">,</span>}
              </div>
            ))}
          </div>
          <div className="flex items-baseline">
            <span className="text-gray-400">{'}'}</span>
          </div>
        </div>
      );
    }

    // Continue with the existing renderValue logic for non-base64 values
    if (base64Result.originalValue === null) {
      return (
        <div className="flex items-baseline">
          <div className="flex items-baseline py-1">
            <ClickableKey 
              fieldKey={key} 
              path={fieldPath}
              isDisabled={isChildOfSelected}
              onKeyClick={onKeyClick}
              mapping={mappings[fieldPath]}
            />
            <span className="ml-2 text-gray-400">: null</span>
          </div>
        </div>
      );
    }

    if (Array.isArray(base64Result.originalValue)) {
      const value = base64Result.originalValue;
      return (
        <div className="flex flex-col">
          <div className="flex items-baseline py-1">
            <ClickableKey 
              fieldKey={key} 
              path={fieldPath}
              isDisabled={isChildOfSelected}
              onKeyClick={onKeyClick}
              mapping={mappings[fieldPath]}
            />
            <span className="ml-2 text-gray-400">: [</span>
          </div>
          <div className="ml-6 border-l-2 border-gray-700 dark:border-gray-600 pl-4">
            {value.map((item, index) => (
              <div key={index} className="flex items-baseline">
                {renderValue(item, `${index}`, `${fieldPath}[${index}]`)}
                {index < value.length - 1 && <span className="text-gray-400">,</span>}
              </div>
            ))}
          </div>
          <div className="flex items-baseline">
            <span className="text-gray-400">]</span>
          </div>
        </div>
      );
    }

    if (typeof base64Result.originalValue === 'object' && base64Result.originalValue !== null) {
      const value = base64Result.originalValue;
      return (
        <div className="flex flex-col">
          <div className="flex items-baseline py-1">
            <ClickableKey 
              fieldKey={key} 
              path={fieldPath}
              isDisabled={isChildOfSelected}
              onKeyClick={onKeyClick}
              mapping={mappings[fieldPath]}
            />
            <span className="ml-2 text-gray-400">: {`{`}</span>
          </div>
          <div className="ml-6 border-l-2 border-gray-700 dark:border-gray-600 pl-4">
            {Object.entries(value as Record<string, unknown>).map(([k, v], index, arr) => (
              <div key={k} className="flex items-baseline">
                {renderValue(v, k, `${fieldPath}.${k}`)}
                {index < arr.length - 1 && <span className="text-gray-400">,</span>}
              </div>
            ))}
          </div>
          <div className="flex items-baseline">
            <span className="text-gray-400">{'}'}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-baseline">
        <div className="flex items-baseline py-1">
          <ClickableKey 
            fieldKey={key} 
            path={fieldPath}
            isDisabled={isChildOfSelected}
            onKeyClick={onKeyClick}
            mapping={mappings[fieldPath]}
          />
          <span className={`ml-2 ${isChildOfSelected ? 'text-gray-500 dark:text-gray-600' : 'text-emerald-500 dark:text-emerald-400'}`}>
            : {typeof base64Result.originalValue === 'string' ? `"${base64Result.originalValue}"` : String(base64Result.originalValue)}
          </span>
        </div>
      </div>
    );
  }, [isChildOfSelected, onKeyClick, mappings]);

  if (typeof data === 'object' && data !== null) {
    return (
      <div className="space-y-1">
        {Object.entries(data as Record<string, unknown>).map(([key, value], index, arr) => {
          const fieldPath = path ? `${path}.${key}` : key;
          return (
            <div key={key} className="flex items-baseline">
              {renderValue(value, key, fieldPath)}
              {index < arr.length - 1 && <span className="text-gray-400">,</span>}
            </div>
          );
        })}
      </div>
    );
  }

  return null;
});

JsonTree.displayName = 'JsonTree';

const TEST_CURL = `curl --request POST \\
  'http://localhost:8080/api/test?config=eyJzZXR0aW5ncyI6eyJtb2RlIjoiZGVidWciLCJlbmFibGVkIjp0cnVlfX0=' \\
  --header 'Content-Type: application/json' \\
  --header 'X-Metadata: eyJ2ZXJzaW9uIjoiMS4wIiwiZW52IjoiZGV2IiwiZGVidWciOnRydWV9' \\
  --data '{
    "user": {
      "profile": "eyJ1c2VySWQiOjEyMywibmFtZSI6IkpvaG4gRG9lIiwicm9sZXMiOlsiYWRtaW4iLCJ1c2VyIl19",
      "settings": {
        "theme": "dark",
        "notifications": true
      }
    },
    "metadata": "eyJzb3VyY2UiOiJ3ZWIiLCJpcCI6IjEyNy4wLjAuMSIsInRpbWVzdGFtcCI6MTcwOTI5MzYwMH0="
  }'`;

// Move parseCurlCommand outside of useEffect
const parseCurlCommand = (curl: string): ParsedCurl => {
  try {
    const lines = curl.split('\n').map(line => line.trim());
    const parsed: ParsedCurl = {
      method: '',
      url: {
        base: '',
        pathParams: {},
        queryParams: {}
      },
      headers: {},
      body: undefined  // Initialize as undefined
    };

    // Parse the first line (URL and method)
    const firstLine = lines[0];
    const methodMatch = firstLine.match(/--request\s+(\w+)/);
    if (methodMatch) {
      parsed.method = methodMatch[1];
    } else {
      parsed.method = 'GET';
    }

    const urlMatch = firstLine.match(/'([^']+)'/);
    if (!urlMatch) {
      throw new Error('Invalid CURL command: URL not found');
    }

    const url = urlMatch[1];
    const [basePath, queryString] = url.split('?');
    
    // Parse path parameters
    const pathParts = basePath.split('/');
    const processedParts: string[] = [];
    
    pathParts.forEach(part => {
      if (part.match(/\{\$P[^}]+\}/)) {
        const paramName = part.slice(3, -1);
        parsed.url.pathParams[paramName] = part;
        processedParts.push(part);
      } else if (part) {
        processedParts.push(part);
      }
    });
    
    parsed.url.base = processedParts.join('/');

    // Parse query parameters
    if (queryString) {
      queryString.split('&').forEach(param => {
        const [key, value] = param.split('=');
        if (key && value) {
          parsed.url.queryParams[decodeURIComponent(key)] = decodeURIComponent(value);
        }
      });
    }

    // Parse headers
    const headerLines = lines.filter(line => line.startsWith('--header'));
    headerLines.forEach(line => {
      const headerMatch = line.match(/--header\s+'([^:]+):\s*([^']+)'/);
      if (headerMatch) {
        const [_, key, value] = headerMatch;
        parsed.headers[key] = value;
      }
    });

    // Only try to parse body for non-GET requests or if explicitly provided
    const dataIndex = lines.findIndex(line => 
      line.includes('--data') || 
      line.includes('--data-raw') || 
      line.includes('-d')
    );

    if (parsed.method !== 'GET' || dataIndex !== -1) {
      if (dataIndex !== -1) {
        let bodyContent = '';
        let i = dataIndex;
        const currentLine = lines[i];
        
        const bodyStartMatch = currentLine.match(/(?:--data(?:-raw)?|-d)\s+'(.*)$/);
        
        if (bodyStartMatch) {
          bodyContent = bodyStartMatch[1];
          
          if (!currentLine.endsWith("'") || currentLine.endsWith("\\'")) {
            i++;
            while (i < lines.length) {
              const line = lines[i];
              if (line.endsWith("'") && !line.endsWith("\\'")) {
                bodyContent += '\n' + line.slice(0, -1);
                break;
              } else {
                bodyContent += '\n' + line;
              }
              i++;
            }
          }

          bodyContent = bodyContent.trim();
          
          try {
            if (bodyContent.startsWith("'") && bodyContent.endsWith("'")) {
              bodyContent = bodyContent.slice(1, -1);
            }
            
            bodyContent = bodyContent
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"')
              .replace(/\\'/g, "'")
              .replace(/\\\\/g, '\\');

            try {
              parsed.body = JSON.parse(bodyContent);
            } catch (firstError) {
              const cleanContent = bodyContent
                .replace(/,\s*}/g, '}')
                .replace(/,\s*\]/g, ']')
                .replace(/\n\s*/g, '')
                .trim();
              
              parsed.body = JSON.parse(cleanContent);
            }
          } catch (error) {
            parsed.body = bodyContent;
          }
        }
      }
    }

    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse CURL command: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const CurlAnalyzer: React.FC<CurlAnalyzerProps> = ({
  curlCommand,
  onFieldMap,
  availableFields,
  requestData
}) => {
  const [parsedCurl, setParsedCurl] = useState<ParsedCurl | null>(null);
  const [panelState, setPanelState] = useState<PanelState>({
    isOpen: false,
    position: { top: 0, right: 0, left: 0, bottom: 0 },
    fieldPath: '',
    fieldType: ''
  });
  const [selectedPath, setSelectedPath] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [mappings, setMappings] = useState<Record<string, MappingInfo>>({});

  useEffect(() => {
    try {
      const parsed = parseCurlCommand(curlCommand);
      
      if (requestData !== undefined) {
        parsed.body = requestData;
      }
      
      setParsedCurl(parsed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CURL command');
      setParsedCurl(null);
    }
  }, [curlCommand, requestData]);

  const handleKeyClick = useCallback((path: string, type: string, event: React.MouseEvent) => {
    setSelectedPath(path);

    // Get the bounding box of the clicked button
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();

    setPanelState({
      isOpen: true,
      position: {
        top: rect.top,      // Use top of clicked element
        right: rect.right,  // Right edge of clicked element
        left: rect.left,    // Left edge of clicked element
        bottom: rect.bottom // Bottom of clicked element
      },
      fieldPath: path,
      fieldType: type
    });
  }, []);

  const handlePanelClose = useCallback(() => {
    setPanelState(prev => ({ ...prev, isOpen: false }));
    setSelectedPath(undefined);
  }, []);

  // Helper function to check if a field path contains Base64 encoded data
  const isFieldBase64Encoded = useCallback((fieldPath: string, parsedCurl: any): boolean => {
    const pathParts = fieldPath.split('.');
    
    // Handle header fields (e.g., "header.encodedHeader" or "header.encodedHeader.email")
    if (pathParts[0] === 'header') {
      if (pathParts.length === 2) {
        // Direct header field like "header.encodedHeader"
        const headerName = pathParts[1];
        const headerValue = parsedCurl?.headers?.[headerName];
        if (headerValue) {
          const base64Result = tryParseBase64Json(headerValue);
          return base64Result.isBase64Json;
        }
      } else if (pathParts.length > 2) {
        // Nested field like "header.encodedHeader.email" - check if parent is Base64
        const headerName = pathParts[1];
        const headerValue = parsedCurl?.headers?.[headerName];
        if (headerValue) {
          const base64Result = tryParseBase64Json(headerValue);
          // If the header is Base64 encoded, then this nested field is part of that Base64 content
          return base64Result.isBase64Json;
        }
      }
      return false;
    }
    
    // Handle body fields with similar logic for nested Base64 content
    if (pathParts[0] === 'data') {
      // For body fields, check if any parent in the path contains Base64
      let current = parsedCurl?.body;
      
      // Check each level to see if it contains Base64
      for (let i = 1; i < pathParts.length; i++) {
        if (current && typeof current === 'object') {
          const fieldName = pathParts[i];
          const fieldValue = current[fieldName];
          
          // Check if this level is Base64 encoded
          const base64Result = tryParseBase64Json(fieldValue);
          if (base64Result.isBase64Json) {
            return true;
          }
          
          // Move to next level
          current = current[fieldName];
        } else {
          break;
        }
      }
      
      return false;
    }
    
    // Handle URL query parameters (e.g., "url.queryParams.param")
    if (pathParts[0] === 'url' && pathParts[1] === 'queryParams' && pathParts.length === 3) {
      // For URL params, we'd need to check the original URL, but for now assume false
      // since Base64 in URL params is less common
      return false;
    }
    
    return false;
  }, []);

  const handleFieldMapping = useCallback((field: string, config?: FixedValueConfig | SpecialFieldConfig) => {
    // Check if the field being mapped was originally Base64 encoded
    const isBase64 = isFieldBase64Encoded(panelState.fieldPath, parsedCurl);
    
    
    let mappingInfo: MappingInfo;
    
    if (!config) {
      // MongoDB field mapping
      mappingInfo = {
        targetField: field,
        type: 'mongodb',
        isBase64Encoded: isBase64
      };
    } else if ('type' in config && typeof (config as SpecialFieldConfig).type === 'string') {
      // Special field mapping
      const specialConfig = config as SpecialFieldConfig;
      mappingInfo = {
        targetField: specialConfig.type,
        type: 'special',
        isBase64Encoded: isBase64
      };
    } else {
      // Fixed value mapping
      const fixedConfig = config as FixedValueConfig;
      mappingInfo = {
        targetField: 'Fixed Value',
        type: 'fixed',
        value: fixedConfig.value,
        isBase64Encoded: isBase64
      };
    }

    setMappings((prev: Record<string, MappingInfo>) => ({
      ...prev,
      [panelState.fieldPath]: mappingInfo
    }));
    
    onFieldMap(panelState.fieldPath, mappingInfo);
  }, [panelState.fieldPath, onFieldMap, isFieldBase64Encoded, parsedCurl]);

  const handleTest = useCallback(() => {
    setParsedCurl(null);
    setError(null);
    setMappings({});
    // Use the test curl command
    try {
      const parsed = parseCurlCommand(TEST_CURL);
      setParsedCurl(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CURL command');
    }
  }, []);

  if (error) {
    return (
      <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4" role="alert">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!parsedCurl) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={handleTest}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Load Test Data
        </button>
      </div>

      {error && (
        <div className="text-red-500 dark:text-red-400 text-sm">{error}</div>
      )}
      
      {parsedCurl && (
        <div className="space-y-6">
          {/* Base URL Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Base URL</h3>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-4">
              <div className="flex items-center space-x-2">
                <ClickableKey
                  fieldKey="base"
                  path="url.base"
                  onKeyClick={handleKeyClick}
                  mapping={mappings['url.base']}
                />
                <span className="text-gray-700 dark:text-gray-300">:</span>
                <span className="text-gray-600 dark:text-gray-400 font-mono">{parsedCurl.url.base}</span>
              </div>
            </div>
          </div>

          {/* URL Parameters Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">URL Parameters</h3>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-4">
              <JsonTree
                data={parsedCurl.url.pathParams}
                path="url.pathParams"
                selectedPath={selectedPath}
                onKeyClick={handleKeyClick}
                mappings={mappings}
              />
            </div>
          </div>

          {/* Query Parameters Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Query Parameters</h3>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-4">
              <JsonTree
                data={parsedCurl.url.queryParams}
                path="url.queryParams"
                selectedPath={selectedPath}
                onKeyClick={handleKeyClick}
                mappings={mappings}
              />
            </div>
          </div>

          {/* Headers Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Headers</h3>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-4">
              <JsonTree
                data={parsedCurl.headers}
                path="header"
                selectedPath={selectedPath}
                onKeyClick={handleKeyClick}
                mappings={mappings}
              />
            </div>
          </div>

          {/* Request Body Section */}
          {parsedCurl.body && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Request Body</h3>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-4">
                <JsonTree
                  data={parsedCurl.body}
                  path="body"
                  selectedPath={selectedPath}
                  onKeyClick={handleKeyClick}
                  mappings={mappings}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <MappingPanel
        isOpen={panelState.isOpen}
        initialPosition={panelState.position}
        onClose={handlePanelClose}
        availableFields={availableFields}
        onSelect={handleFieldMapping}
        fieldPath={panelState.fieldPath}
      />
    </div>
  );
}; 