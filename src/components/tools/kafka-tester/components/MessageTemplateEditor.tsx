import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronLeftIcon, InformationCircleIcon, XMarkIcon, MagnifyingGlassIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import MonacoEditor from '../../../../common/editor/MonacoEditor';
import { useTheme } from '../../../../hooks/useTheme';

interface MessageTemplate {
  rawTemplate: string;
  parsedTemplate: {
    key?: string;
    value: any;
    headers?: Record<string, string>;
  };
}

interface MessageTemplateEditorProps {
  template: MessageTemplate;
  availableFields: string[];
  onTemplateChange: (template: MessageTemplate) => void;
  onBack: () => void;
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
  type: 'uuid' | 'timestamp' | 'random_uuid' | 'message_index' | 'document' | 'unix_timestamp' | 'date_only' | 'uuid_v4' | 'uuid_v4_short' | 'uuid_v1' | 'nanoid' | 'random_int' | 'random_float' | 'random_string' | 'random_email' | 'batch_id';
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
}

interface JsonTreeProps {
  data: Record<string, unknown> | unknown[] | string;
  path?: string;
  selectedPath?: string;
  onKeyClick: (path: string, type: string, event: React.MouseEvent) => void;
  mappings?: Record<string, MappingInfo>;
}

const ClickableKey: React.FC<{
  fieldKey: string;
  path: string;
  isDisabled?: boolean;
  onKeyClick: (path: string, type: string, event: React.MouseEvent) => void;
  mapping?: MappingInfo;
}> = ({ fieldKey, path, isDisabled = false, onKeyClick, mapping }) => (
  <div className="relative group">
    <button
      onClick={(e) => !isDisabled && onKeyClick(path, 'templateField', e)}
      className={`
        font-mono text-sm rounded px-1.5 py-0.5 transition-colors duration-150 flex items-center
        ${isDisabled
          ? 'text-gray-500 dark:text-gray-600 cursor-not-allowed'
          : mapping
            ? 'text-blue-500 dark:text-blue-400 bg-blue-100 dark:bg-blue-900'
            : 'text-blue-500 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900'
        }
      `}
      aria-label={`Map field ${fieldKey}`}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
    >
      {fieldKey}
      {mapping && (
        <>
          <div className="ml-2 h-2 w-2 rounded-full bg-green-400"></div>
          <div className="absolute z-50 bottom-full left-0 mb-1 px-2 py-1 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {mapping.type === 'mongodb' && `Mapped to: {{${mapping.targetField}}}`}
            {mapping.type === 'fixed' && `Fixed value: ${mapping.value}`}
            {mapping.type === 'special' && `Special: {{${mapping.targetField}}}`}
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

      const panelElement = panelRef.current;
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };

      // Panel dimensions (estimate)
      const panelWidth = 450; // Increased width for better readability
      const panelHeight = 600; // Increased height for more content

      let left = initialPosition.left;
      let top = initialPosition.top;
      let right = 'auto';
      let bottom = 'auto';

      // Smart horizontal positioning
      if (left + panelWidth > viewport.width - 20) {
        // If panel would go off the right edge, position it to the left of the click point
        right = viewport.width - initialPosition.left + 10;
        left = 'auto';
      } else {
        // Default: position to the right of the click point
        left = initialPosition.left + 10;
      }

      // Smart vertical positioning  
      if (top + panelHeight > viewport.height - 20) {
        // If panel would go off the bottom edge, position it above or adjust
        if (initialPosition.top > panelHeight + 20) {
          // Enough space above, position above the click point
          bottom = viewport.height - initialPosition.top + 10;
          top = 'auto';
        } else {
          // Not enough space above or below, center vertically
          top = Math.max(20, (viewport.height - panelHeight) / 2);
        }
      } else {
        // Default: position below the click point
        top = initialPosition.top + 10;
      }

      // Ensure minimum margins from viewport edges
      if (typeof left === 'number') {
        left = Math.max(20, Math.min(left, viewport.width - panelWidth - 20));
      }
      if (typeof top === 'number') {
        top = Math.max(20, Math.min(top, viewport.height - panelHeight - 20));
      }

      setPositionStyle({
        position: 'fixed',
        left: left === 'auto' ? 'auto' : `${left}px`,
        top: top === 'auto' ? 'auto' : `${top}px`,
        right: right === 'auto' ? 'auto' : `${right}px`,
        bottom: bottom === 'auto' ? 'auto' : `${bottom}px`,
        width: `${panelWidth}px`,
        maxWidth: `${Math.min(panelWidth, viewport.width - 40)}px`,
        maxHeight: `${Math.min(panelHeight, viewport.height - 40)}px`,
        zIndex: 1000
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

  const renderMongoDBTab = () => {
    const filteredFields = availableFields.filter(field =>
      field.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <>
        <div className="relative mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search fields..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            aria-label="Search fields"
          />
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>

        <div className="max-h-[40vh] overflow-y-auto rounded-md border border-gray-200 dark:border-gray-600 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          {filteredFields.length > 0 ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-600">
              {filteredFields.map((field, index) => (
                <button
                  key={index}
                  onClick={() => onSelect(field)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  aria-label={`Select field ${field}`}
                >
                  <span className="font-mono">{field}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
              No matching fields found
            </div>
          )}
        </div>
      </>
    );
  };

  const renderFixedValueTab = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Value Type
        </label>
        <select
          value={fixedValueConfig.type}
          onChange={(e) => setFixedValueConfig(prev => ({ ...prev, type: e.target.value as FixedValueConfig['type'] }))}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
          aria-label="Select value type"
        >
          <option value="string">String</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
          <option value="date">Date</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Value
        </label>
        <div className="flex items-center space-x-2">
          <input
            type={fixedValueConfig.type === 'number' ? 'number' : 'text'}
            value={fixedValueConfig.value}
            onChange={(e) => setFixedValueConfig(prev => ({ ...prev, value: e.target.value }))}
            disabled={fixedValueConfig.isRandom}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent disabled:opacity-50"
            placeholder={fixedValueConfig.isRandom ? 'Random value will be generated' : 'Enter value'}
          />
          <button
            onClick={() => setFixedValueConfig(prev => ({ ...prev, isRandom: !prev.isRandom }))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          >
            {fixedValueConfig.isRandom ? 'Fixed' : 'Random'}
          </button>
        </div>
      </div>

      {fixedValueConfig.isRandom && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Regex Pattern (optional)
          </label>
          <input
            type="text"
            value={fixedValueConfig.regex || ''}
            onChange={(e) => setFixedValueConfig(prev => ({ ...prev, regex: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            placeholder="Enter regex pattern for random value"
          />
        </div>
      )}

      <button
        onClick={handleFixedValueSubmit}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
      >
        Apply Fixed Value
      </button>
    </div>
  );

  const renderSpecialFieldTab = () => (
    <div className="space-y-4">
      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Available Special Fields
        </h4>
        <div className="space-y-2">
          {/* Document Fields */}
          <button
            onClick={() => handleSpecialFieldSubmit('document')}
            className="w-full px-4 py-2 text-left border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          >
            <span className="font-mono">{`{{$document}}`}</span>
            <span className="block text-sm text-gray-500 dark:text-gray-400">
              Entire MongoDB document (JSON)
            </span>
          </button>

          {/* Timestamp Fields */}
          <button
            onClick={() => handleSpecialFieldSubmit('timestamp')}
            className="w-full px-4 py-2 text-left border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          >
            <span className="font-mono">{`{{timestamp}}`}</span>
            <span className="block text-sm text-gray-500 dark:text-gray-400">
              Current ISO timestamp (2024-01-15T10:30:00.000Z)
            </span>
          </button>

          <button
            onClick={() => handleSpecialFieldSubmit('unix_timestamp')}
            className="w-full px-4 py-2 text-left border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          >
            <span className="font-mono">{`{{unix_timestamp}}`}</span>
            <span className="block text-sm text-gray-500 dark:text-gray-400">
              Unix timestamp in milliseconds (1705312200000)
            </span>
          </button>

          <button
            onClick={() => handleSpecialFieldSubmit('date_only')}
            className="w-full px-4 py-2 text-left border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          >
            <span className="font-mono">{`{{date_only}}`}</span>
            <span className="block text-sm text-gray-500 dark:text-gray-400">
              Current date only (2024-01-15)
            </span>
          </button>

          {/* UUID Fields */}
          <div className="border-t border-gray-300 dark:border-gray-600 mt-3 pt-3">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">UUID Variants</div>

            <button
              onClick={() => handleSpecialFieldSubmit('uuid_v4')}
              className="w-full px-4 py-2 text-left border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 mb-2"
            >
              <span className="font-mono">{`{{uuid_v4}}`}</span>
              <span className="block text-sm text-gray-500 dark:text-gray-400">
                Random UUID v4 (550e8400-e29b-41d4-a716-446655440000)
              </span>
            </button>

            <button
              onClick={() => handleSpecialFieldSubmit('uuid_v4_short')}
              className="w-full px-4 py-2 text-left border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 mb-2"
            >
              <span className="font-mono">{`{{uuid_v4_short}}`}</span>
              <span className="block text-sm text-gray-500 dark:text-gray-400">
                UUID v4 without hyphens (550e8400e29b41d4a716446655440000)
              </span>
            </button>

            <button
              onClick={() => handleSpecialFieldSubmit('uuid_v1')}
              className="w-full px-4 py-2 text-left border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 mb-2"
            >
              <span className="font-mono">{`{{uuid_v1}}`}</span>
              <span className="block text-sm text-gray-500 dark:text-gray-400">
                Time-based UUID v1 (unique per machine)
              </span>
            </button>

            <button
              onClick={() => handleSpecialFieldSubmit('nanoid')}
              className="w-full px-4 py-2 text-left border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              <span className="font-mono">{`{{nanoid}}`}</span>
              <span className="block text-sm text-gray-500 dark:text-gray-400">
                Short unique ID (V1StGXR8_Z5jdHi6B-myT)
              </span>
            </button>
          </div>

          {/* Random Data Fields */}
          <div className="border-t border-gray-300 dark:border-gray-600 mt-3 pt-3">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">Random Data</div>

            <button
              onClick={() => handleSpecialFieldSubmit('random_int')}
              className="w-full px-4 py-2 text-left border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 mb-2"
            >
              <span className="font-mono">{`{{random_int}}`}</span>
              <span className="block text-sm text-gray-500 dark:text-gray-400">
                Random integer between 1-1000000
              </span>
            </button>

            <button
              onClick={() => handleSpecialFieldSubmit('random_float')}
              className="w-full px-4 py-2 text-left border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 mb-2"
            >
              <span className="font-mono">{`{{random_float}}`}</span>
              <span className="block text-sm text-gray-500 dark:text-gray-400">
                Random float with 2 decimals (123.45)
              </span>
            </button>

            <button
              onClick={() => handleSpecialFieldSubmit('random_string')}
              className="w-full px-4 py-2 text-left border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 mb-2"
            >
              <span className="font-mono">{`{{random_string}}`}</span>
              <span className="block text-sm text-gray-500 dark:text-gray-400">
                Random alphanumeric string (AbC123XyZ)
              </span>
            </button>

            <button
              onClick={() => handleSpecialFieldSubmit('random_email')}
              className="w-full px-4 py-2 text-left border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              <span className="font-mono">{`{{random_email}}`}</span>
              <span className="block text-sm text-gray-500 dark:text-gray-400">
                Random email address (user123@example.com)
              </span>
            </button>
          </div>

          {/* Message Context Fields */}
          <div className="border-t border-gray-300 dark:border-gray-600 mt-3 pt-3">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">Message Context</div>

            <button
              onClick={() => handleSpecialFieldSubmit('message_index')}
              className="w-full px-4 py-2 text-left border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 mb-2"
            >
              <span className="font-mono">{`{{message_index}}`}</span>
              <span className="block text-sm text-gray-500 dark:text-gray-400">
                Sequential message number (0, 1, 2, ...)
              </span>
            </button>

            <button
              onClick={() => handleSpecialFieldSubmit('batch_id')}
              className="w-full px-4 py-2 text-left border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              <span className="font-mono">{`{{batch_id}}`}</span>
              <span className="block text-sm text-gray-500 dark:text-gray-400">
                Unique batch identifier for this test run
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/25 backdrop-blur-sm z-40"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        style={{
          ...positionStyle,
          maxHeight: '90vh',
        }}
        className={`
          bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700
          z-50 flex flex-col rounded-lg overflow-hidden
        `}
      >
        <div className="h-full flex flex-col">
          <div className="flex-none p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Map Field: <span className="font-mono text-blue-600 dark:text-blue-400 text-base">{fieldPath}</span>
              </h3>
              <button
                onClick={onClose}
                aria-label="Close mapping panel"
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 rounded-full p-1"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            <div className="h-full overflow-y-auto p-4">
              <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
                <nav className="-mb-px flex space-x-8" aria-label="Mapping options">
                  <button
                    onClick={() => setActiveTab('mongodb')}
                    className={`
                      py-2 px-1 border-b-2 font-medium text-sm
                      ${activeTab === 'mongodb'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }
                    `}
                  >
                    MongoDB Field
                  </button>
                  <button
                    onClick={() => setActiveTab('fixed')}
                    className={`
                      py-2 px-1 border-b-2 font-medium text-sm
                      ${activeTab === 'fixed'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }
                    `}
                  >
                    Fixed Value
                  </button>
                  <button
                    onClick={() => setActiveTab('special')}
                    className={`
                      py-2 px-1 border-b-2 font-medium text-sm
                      ${activeTab === 'special'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }
                    `}
                  >
                    Special Field
                  </button>
                </nav>
              </div>

              <div className="mt-4">
                {activeTab === 'mongodb' && renderMongoDBTab()}
                {activeTab === 'fixed' && renderFixedValueTab()}
                {activeTab === 'special' && renderSpecialFieldTab()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const JsonTree: React.FC<JsonTreeProps> = React.memo(({
  data,
  path = '',
  selectedPath,
  onKeyClick,
  mappings = {}
}) => {
  const isChildOfSelected = Boolean(selectedPath && path.startsWith(selectedPath + '.'));
  const isSelected = selectedPath === path;

  const renderValue = useCallback((value: unknown, key: string, fieldPath: string) => {
    if (value === null) {
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

    if (Array.isArray(value)) {
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

    if (typeof value === 'object' && value !== null) {
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
            : {typeof value === 'string' ? `"${value}"` : String(value)}
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

export const MessageTemplateEditor: React.FC<MessageTemplateEditorProps> = ({
  template,
  availableFields,
  onTemplateChange,
  onBack
}) => {
  const { theme } = useTheme();
  const [rawTemplate, setRawTemplate] = useState(template?.rawTemplate || '');
  const [parseError, setParseError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);
  const [viewMode, setViewMode] = useState<'visual' | 'code'>('visual');
  const [parsedData, setParsedData] = useState<any>(null);
  const [panelState, setPanelState] = useState<PanelState>({
    isOpen: false,
    position: { top: 0, right: 0, left: 0, bottom: 0 },
    fieldPath: '',
    fieldType: ''
  });
  const [selectedPath, setSelectedPath] = useState<string | undefined>();
  const [mappings, setMappings] = useState<Record<string, MappingInfo>>({});

  // Initialize with a basic template if empty
  useEffect(() => {
    if (!rawTemplate) {
      const basicTemplate = {
        key: "Click to map →",
        value: {
          id: "Click to map →",
          timestamp: "Click to map →",
          data: "Click to map →"
        },
        headers: {
          source: "mongodb"
        }
      };
      setRawTemplate(JSON.stringify(basicTemplate, null, 2));
    }
  }, [rawTemplate]);

  // Validate and parse template whenever it changes
  useEffect(() => {
    try {
      const parsed = JSON.parse(rawTemplate);
      setParsedData(parsed);
      setParseError(null);
      setIsValid(true);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Invalid JSON');
      setIsValid(false);
      setParsedData(null);
    }
  }, [rawTemplate]);

  const handleTemplateChange = useCallback((value: string) => {
    setRawTemplate(value || '');
  }, []);

  const handleKeyClick = useCallback((path: string, type: string, event: React.MouseEvent) => {
    setSelectedPath(path);

    // Get the bounding box of the clicked button
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();

    setPanelState({
      isOpen: true,
      position: {
        top: rect.top,
        right: rect.right,
        left: rect.left,
        bottom: rect.bottom
      },
      fieldPath: path,
      fieldType: type
    });
  }, []);

  const handlePanelClose = useCallback(() => {
    setPanelState(prev => ({ ...prev, isOpen: false }));
    setSelectedPath(undefined);
  }, []);

  const updateNestedValue = (obj: any, path: string, value: string): any => {
    const keys = path.split('.');
    const result = JSON.parse(JSON.stringify(obj)); // Deep clone

    let current = result;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
    return result;
  };

  const handleFieldMapping = useCallback((field: string, config?: FixedValueConfig | SpecialFieldConfig) => {
    let mappingInfo: MappingInfo;
    let placeholderValue: string;

    if (!config) {
      // MongoDB field mapping
      mappingInfo = {
        targetField: field,
        type: 'mongodb'
      };
      placeholderValue = `{{${field}}}`;
    } else if ('type' in config && ['timestamp', 'random_uuid', 'message_index', 'document'].includes(config.type)) {
      // Special field mapping
      const specialConfig = config as SpecialFieldConfig;
      mappingInfo = {
        targetField: specialConfig.type === 'document' ? '$document' : specialConfig.type,
        type: 'special'
      };
      placeholderValue = specialConfig.type === 'document' ? '{{$document}}' : `{{${specialConfig.type}}}`;
    } else {
      // Fixed value mapping
      const fixedConfig = config as FixedValueConfig;
      mappingInfo = {
        targetField: 'Fixed Value',
        type: 'fixed',
        value: fixedConfig.value
      };
      placeholderValue = fixedConfig.value;
    }

    setMappings((prev: Record<string, MappingInfo>) => ({
      ...prev,
      [panelState.fieldPath]: mappingInfo
    }));

    // Update the template with the new placeholder value
    if (parsedData) {
      const updatedData = updateNestedValue(parsedData, panelState.fieldPath, placeholderValue);
      setRawTemplate(JSON.stringify(updatedData, null, 2));
    }
  }, [panelState.fieldPath, parsedData]);

  const handleContinue = useCallback(() => {
    if (!isValid) return;

    try {
      const parsedTemplate = JSON.parse(rawTemplate);
      onTemplateChange({
        rawTemplate,
        parsedTemplate
      });
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Invalid JSON');
    }
  }, [rawTemplate, isValid, onTemplateChange]);

  const loadPreset = useCallback((preset: string) => {
    const presets = {
      basic: {
        key: "{{_id}}",
        value: {
          id: "{{_id}}",
          timestamp: "{{timestamp}}",
          data: "{{$document}}"
        },
        headers: {
          "source": "mongodb"
        }
      },
      user_activity: {
        key: "{{userId}}",
        value: {
          userId: "{{userId}}",
          action: "{{action}}",
          timestamp: "{{timestamp}}",
          sessionId: "{{sessionId}}",
          metadata: "{{metadata}}"
        },
        headers: {
          "eventType": "user_activity",
          "source": "mongodb"
        }
      },
      order_event: {
        key: "{{orderId}}",
        value: {
          orderId: "{{orderId}}",
          customerId: "{{customerId}}",
          total: "{{total}}",
          status: "{{status}}",
          items: "{{items}}",
          timestamp: "{{createdAt}}"
        },
        headers: {
          "eventType": "order",
          "source": "mongodb"
        }
      }
    };

    const selectedPreset = presets[preset as keyof typeof presets];
    if (selectedPreset) {
      setRawTemplate(JSON.stringify(selectedPreset, null, 2));
      setMappings({}); // Clear existing mappings when loading preset
    }
  }, []);

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
            Define Message Template
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Click on fields to map them to MongoDB data
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <select
            onChange={(e) => e.target.value && loadPreset(e.target.value)}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
            defaultValue=""
            aria-label="Load template preset"
          >
            <option value="">Load Preset...</option>
            <option value="basic">Basic Template</option>
            <option value="user_activity">User Activity</option>
            <option value="order_event">Order Event</option>
          </select>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex justify-center">
        <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('visual')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'visual'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
          >
            Visual Editor
          </button>
          <button
            onClick={() => setViewMode('code')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'code'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
          >
            Code Editor
          </button>
        </div>
      </div>

      {viewMode === 'visual' ? (
        <div className="space-y-6">
          {/* Interactive JSON Template */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4 flex items-center">
              <DocumentTextIcon className="w-5 h-5 mr-2" />
              Kafka Message Template
              <span className="ml-2 text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded">
                Click fields to map
              </span>
            </h4>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              {parsedData ? (
                <JsonTree
                  data={parsedData}
                  selectedPath={selectedPath}
                  onKeyClick={handleKeyClick}
                  mappings={mappings}
                />
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <DocumentTextIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Invalid JSON template</p>
                  <p className="text-sm">Switch to Code Editor to fix syntax errors</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Message Template (JSON)
                <div className="group relative inline-block ml-2">
                  <InformationCircleIcon className="w-4 h-4 text-gray-400" />
                  <div className="hidden group-hover:block absolute z-10 w-64 px-2 py-1 text-xs text-white bg-gray-900 rounded-md -right-1 transform translate-x-full">
                    Use placeholders like {`{{fieldName}}`} to reference MongoDB fields. Special placeholders: {`{{$document}}`} (entire document), {`{{timestamp}}`} (current timestamp)
                  </div>
                </div>
              </label>
            </div>

            <div className="border rounded-md overflow-hidden">
              <MonacoEditor
                value={rawTemplate}
                onChange={handleTemplateChange}
                language="json"
                height="400px"
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
              />
            </div>

            {parseError && (
              <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                <strong>JSON Error:</strong> {parseError}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-center pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleContinue}
          disabled={!isValid || !rawTemplate.trim()}
          className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Continue to Kafka Setup
          <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

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