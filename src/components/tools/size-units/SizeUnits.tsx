import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { BaseToolProps } from '../types';
import { useToolState } from '../../../hooks/useToolState';
import { 
  ArrowsRightLeftIcon, 
  ClipboardDocumentIcon, 
  CheckIcon,
  TrashIcon,
  SparklesIcon,
  ComputerDesktopIcon,
  HeartIcon,
  FilmIcon,
  ServerIcon,
  CloudIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { useTheme } from '../../../hooks/useTheme';

interface SizeUnitsState {
  inputValue: string;
  outputValue: string;
  fromUnit: string;
  toUnit: string;
  copySuccess: boolean;
  history: ConversionHistoryItem[];
  favorites: string[];
  showContext: boolean;
  currentTimestamp: number;
}

interface ConversionHistoryItem {
  id: string;
  value: number;
  fromUnit: string;
  toUnit: string;
  result: number;
  timestamp: number;
}

// Size units with comprehensive coverage (all in bytes for base conversion)
const SIZE_UNITS = {
  // Bits
  bits: 0.125,
  
  // Bytes (decimal)
  bytes: 1,
  kilobytes: 1000,
  megabytes: 1000000,
  gigabytes: 1000000000,
  terabytes: 1000000000000,
  petabytes: 1000000000000000,
  exabytes: 1000000000000000000,
  
  // Bytes (binary - traditional computer science)
  kibibytes: 1024,
  mebibytes: 1048576, // 1024^2
  gibibytes: 1073741824, // 1024^3
  tebibytes: 1099511627776, // 1024^4
  pebibytes: 1125899906842624, // 1024^5
  exbibytes: 1152921504606846976, // 1024^6
  
  // Storage shorthand (using decimal)
  KB: 1000,
  MB: 1000000,
  GB: 1000000000,
  TB: 1000000000000,
  PB: 1000000000000000,
  
  // Binary shorthand  
  KiB: 1024,
  MiB: 1048576,
  GiB: 1073741824,
  TiB: 1099511627776,
  PiB: 1125899906842624,
  
  // Network/bandwidth units (bits per second base)
  'bits/s': 0.125,
  'kbps': 125, // kilobits per second
  'Mbps': 125000, // megabits per second  
  'Gbps': 125000000, // gigabits per second
  'Tbps': 125000000000, // terabits per second
};

const UNIT_LABELS = {
  bits: { name: 'Bits', symbol: 'bit', icon: '🔢', category: 'Basic' },
  bytes: { name: 'Bytes', symbol: 'B', icon: '💾', category: 'Basic' },
  
  // Decimal (SI units)
  kilobytes: { name: 'Kilobytes', symbol: 'kB', icon: '📄', category: 'Decimal' },
  megabytes: { name: 'Megabytes', symbol: 'MB', icon: '📊', category: 'Decimal' },
  gigabytes: { name: 'Gigabytes', symbol: 'GB', icon: '💿', category: 'Decimal' },
  terabytes: { name: 'Terabytes', symbol: 'TB', icon: '🗄️', category: 'Decimal' },
  petabytes: { name: 'Petabytes', symbol: 'PB', icon: '🏢', category: 'Decimal' },
  exabytes: { name: 'Exabytes', symbol: 'EB', icon: '🌐', category: 'Decimal' },
  
  // Binary (traditional CS)
  kibibytes: { name: 'Kibibytes', symbol: 'KiB', icon: '📝', category: 'Binary' },
  mebibytes: { name: 'Mebibytes', symbol: 'MiB', icon: '🎵', category: 'Binary' },
  gibibytes: { name: 'Gibibytes', symbol: 'GiB', icon: '🎬', category: 'Binary' },
  tebibytes: { name: 'Tebibytes', symbol: 'TiB', icon: '💽', category: 'Binary' },
  pebibytes: { name: 'Pebibytes', symbol: 'PiB', icon: '🏗️', category: 'Binary' },
  exbibytes: { name: 'Exbibytes', symbol: 'EiB', icon: '🌍', category: 'Binary' },
  
  // Common shortcuts
  KB: { name: 'KB (Decimal)', symbol: 'KB', icon: '📄', category: 'Shorthand' },
  MB: { name: 'MB (Decimal)', symbol: 'MB', icon: '📊', category: 'Shorthand' },
  GB: { name: 'GB (Decimal)', symbol: 'GB', icon: '💿', category: 'Shorthand' },
  TB: { name: 'TB (Decimal)', symbol: 'TB', icon: '🗄️', category: 'Shorthand' },
  PB: { name: 'PB (Decimal)', symbol: 'PB', icon: '🏢', category: 'Shorthand' },
  
  KiB: { name: 'KiB (Binary)', symbol: 'KiB', icon: '📝', category: 'Shorthand' },
  MiB: { name: 'MiB (Binary)', symbol: 'MiB', icon: '🎵', category: 'Shorthand' },
  GiB: { name: 'GiB (Binary)', symbol: 'GiB', icon: '🎬', category: 'Shorthand' },
  TiB: { name: 'TiB (Binary)', symbol: 'TiB', icon: '💽', category: 'Shorthand' },
  PiB: { name: 'PiB (Binary)', symbol: 'PiB', icon: '🏗️', category: 'Shorthand' },
  
  // Network/bandwidth
  'bits/s': { name: 'Bits per second', symbol: 'bps', icon: '🌐', category: 'Network' },
  'kbps': { name: 'Kilobits per second', symbol: 'kbps', icon: '📡', category: 'Network' },
  'Mbps': { name: 'Megabits per second', symbol: 'Mbps', icon: '🚀', category: 'Network' },
  'Gbps': { name: 'Gigabits per second', symbol: 'Gbps', icon: '⚡', category: 'Network' },
  'Tbps': { name: 'Terabits per second', symbol: 'Tbps', icon: '🔥', category: 'Network' }
};

// Programming-relevant presets
const PRESETS = [
  // Memory sizes
  { name: 'Cache Line (64B)', fromUnit: 'bytes', value: () => 64 },
  { name: 'Memory Page (4KB)', fromUnit: 'KiB', value: () => 4 },
  { name: 'Stack Size (8MB)', fromUnit: 'MiB', value: () => 8 },
  { name: 'Modern RAM (16GB)', fromUnit: 'GiB', value: () => 16 },
  { name: 'High-end RAM (64GB)', fromUnit: 'GiB', value: () => 64 },
  
  // File sizes
  { name: 'Empty File', fromUnit: 'bytes', value: () => 0 },
  { name: 'Small Image (100KB)', fromUnit: 'KB', value: () => 100 },
  { name: 'MP3 Song (3MB)', fromUnit: 'MB', value: () => 3 },
  { name: 'High-res Photo (10MB)', fromUnit: 'MB', value: () => 10 },
  { name: '4K Video (1GB/min)', fromUnit: 'GB', value: () => 1 },
  
  // Storage devices
  { name: 'DVD Capacity', fromUnit: 'GB', value: () => 4.7 },
  { name: 'Blu-ray Capacity', fromUnit: 'GB', value: () => 25 },
  { name: 'USB Flash (32GB)', fromUnit: 'GB', value: () => 32 },
  { name: 'SSD (1TB)', fromUnit: 'TB', value: () => 1 },
  { name: 'Enterprise HDD (18TB)', fromUnit: 'TB', value: () => 18 },
  
  // Network speeds
  { name: 'Dialup Modem', fromUnit: 'kbps', value: () => 56 },
  { name: 'Basic Broadband', fromUnit: 'Mbps', value: () => 25 },
  { name: 'Gigabit Ethernet', fromUnit: 'Gbps', value: () => 1 },
  { name: '10G Ethernet', fromUnit: 'Gbps', value: () => 10 },
  
  // Database sizes
  { name: 'Small Database', fromUnit: 'MB', value: () => 100 },
  { name: 'Medium Database', fromUnit: 'GB', value: () => 10 },
  { name: 'Large Database', fromUnit: 'TB', value: () => 1 },
  
  // Programming contexts
  { name: 'IPv4 Address', fromUnit: 'bytes', value: () => 4 },
  { name: 'IPv6 Address', fromUnit: 'bytes', value: () => 16 },
  { name: 'UUID', fromUnit: 'bytes', value: () => 16 },
  { name: 'SHA-256 Hash', fromUnit: 'bytes', value: () => 32 }
];

const SizeUnits: React.FC<BaseToolProps> = (props) => {
  const { state, setState } = useToolState(props);
  const { theme } = useTheme();
  const historyRef = useRef<HTMLDivElement>(null);

  // Initialize state
  useEffect(() => {
    if (!state.fromUnit) {
      setState({ 
        inputValue: '',
        outputValue: '',
        fromUnit: 'bytes',
        toUnit: 'kilobytes',
        copySuccess: false,
        history: [],
        favorites: ['bytes', 'KB', 'MB', 'GB', 'KiB', 'MiB', 'GiB'],
        showContext: true,
        currentTimestamp: Date.now()
      });
    }
  }, [state.fromUnit, setState]);

  // Smart precision based on value and unit
  const getSmartPrecision = useCallback((value: number, unit: string): number => {
    if (value === 0) return 0;
    
    const absValue = Math.abs(value);
    
    // For very small values, show more precision
    if (absValue < 0.001) return 8;
    if (absValue < 0.01) return 6;
    if (absValue < 0.1) return 4;
    if (absValue < 1) return 3;
    if (absValue < 10) return 2;
    if (absValue < 100) return 1;
    
    // For large values, show fewer decimals
    return 0;
  }, []);

  // Convert size with smart precision
  const convertSize = useCallback((value: number, fromUnit: string, toUnit: string) => {
    if (isNaN(value) || value < 0) return '';
    
    const fromBytes = SIZE_UNITS[fromUnit as keyof typeof SIZE_UNITS];
    const toBytes = SIZE_UNITS[toUnit as keyof typeof SIZE_UNITS];
    
    if (!fromBytes || !toBytes) return '';
    
    const bytes = value * fromBytes;
    const result = bytes / toBytes;
    const precision = getSmartPrecision(result, toUnit);
    
    return result.toFixed(precision);
  }, [getSmartPrecision]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setState({ inputValue });
    
    const value = parseFloat(inputValue);
    if (!isNaN(value) && value >= 0) {
      const result = convertSize(value, state.fromUnit, state.toUnit);
      setState({ outputValue: result });
    } else {
      setState({ outputValue: '' });
    }
  }, [convertSize, setState, state.fromUnit, state.toUnit]);

  // Handle unit changes
  const handleFromUnitChange = useCallback((unit: string) => {
    setState({ fromUnit: unit });
    const value = parseFloat(state.inputValue);
    if (!isNaN(value) && value >= 0) {
      const result = convertSize(value, unit, state.toUnit);
      setState({ outputValue: result });
    }
  }, [convertSize, setState, state.inputValue, state.toUnit]);

  const handleToUnitChange = useCallback((unit: string) => {
    setState({ toUnit: unit });
    const value = parseFloat(state.inputValue);
    if (!isNaN(value) && value >= 0) {
      const result = convertSize(value, state.fromUnit, unit);
      setState({ outputValue: result });
    }
  }, [convertSize, setState, state.inputValue, state.fromUnit]);

  // Swap units
  const swapUnits = useCallback(() => {
    const newFromUnit = state.toUnit;
    const newToUnit = state.fromUnit;
    const newInputValue = state.outputValue;
    
    setState({ 
      fromUnit: newFromUnit, 
      toUnit: newToUnit,
      inputValue: newInputValue
    });
    
    const value = parseFloat(newInputValue);
    if (!isNaN(value) && value >= 0) {
      const result = convertSize(value, newFromUnit, newToUnit);
      setState({ outputValue: result });
    }
  }, [convertSize, setState, state.fromUnit, state.toUnit, state.outputValue]);

  // Add to history
  const addToHistory = useCallback((value: number, fromUnit: string, toUnit: string, result: number) => {
    const historyItem: ConversionHistoryItem = {
      id: Date.now().toString(),
      value,
      fromUnit,
      toUnit,
      result,
      timestamp: Date.now()
    };
    
    const newHistory = [historyItem, ...(state.history || [])].slice(0, 10); // Keep last 10
    setState({ history: newHistory });
  }, [setState, state.history]);

  // Apply conversion and add to history
  const applyConversion = useCallback(() => {
    const value = parseFloat(state.inputValue);
    const result = parseFloat(state.outputValue);
    
    if (!isNaN(value) && !isNaN(result) && value >= 0) {
      addToHistory(value, state.fromUnit, state.toUnit, result);
    }
  }, [addToHistory, state.inputValue, state.outputValue, state.fromUnit, state.toUnit]);

  // Apply conversion when output changes
  useEffect(() => {
    if (state.outputValue && state.inputValue) {
      const timeoutId = setTimeout(applyConversion, 1000); // Add to history after 1 second of no changes
      return () => clearTimeout(timeoutId);
    }
  }, [state.outputValue, applyConversion]);

  // Copy to clipboard
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setState({ copySuccess: true });
      setTimeout(() => setState({ copySuccess: false }), 2000);
    });
  }, [setState]);

  // Apply preset
  const applyPreset = useCallback((preset: typeof PRESETS[0]) => {
    const value = typeof preset.value === 'function' ? preset.value() : preset.value;
    setState({ 
      inputValue: value.toString(),
      fromUnit: preset.fromUnit
    });
    
    const result = convertSize(value, preset.fromUnit, state.toUnit);
    setState({ outputValue: result });
  }, [convertSize, setState, state.toUnit]);

  // Clear all
  const clearAll = useCallback(() => {
    setState({ 
      inputValue: '',
      outputValue: '',
      history: []
    });
  }, [setState]);

  // Get real-world context for developers
  const getRealWorldContext = useCallback((value: number, unit: string) => {
    const contexts: Array<{ condition: (bytes: number) => boolean; text: string; icon: string }> = [
      { condition: (b) => b < 1, text: 'Less than a single byte', icon: '🔬' },
      { condition: (b) => b < 64, text: 'Fits in a CPU cache line', icon: '🖥️' },
      { condition: (b) => b < 1024, text: 'Small data structure size', icon: '📦' },
      { condition: (b) => b < 4096, text: 'Memory page size range', icon: '📄' },
      { condition: (b) => b < 1048576, text: 'Small file or buffer', icon: '📁' },
      { condition: (b) => b < 16777216, text: 'Typical application memory', icon: '💾' },
      { condition: (b) => b < 1073741824, text: 'Large file or dataset', icon: '📊' },
      { condition: (b) => b < 17179869184, text: 'RAM or SSD capacity range', icon: '🔧' },
      { condition: (b) => b < 1099511627776, text: 'High-capacity storage', icon: '🗄️' },
      { condition: (b) => b >= 1099511627776, text: 'Enterprise/datacenter scale', icon: '🏢' }
    ];
    
    const bytes = value * SIZE_UNITS[unit as keyof typeof SIZE_UNITS];
    const context = contexts.find(c => c.condition(bytes));
    
    return context || { text: 'Massive data storage', icon: '🌌' };
  }, []);

  // Get practical programming examples
  const getPracticalExamples = useCallback((value: number, unit: string) => {
    const bytes = value * SIZE_UNITS[unit as keyof typeof SIZE_UNITS];
    const examples = [];
    
    // Common file types
    if (bytes >= 50000 && bytes <= 500000) {
      examples.push('Small image or document 📸');
    }
    if (bytes >= 1000000 && bytes <= 50000000) {
      examples.push('High-quality photo or song 🎵');
    }
    if (bytes >= 100000000 && bytes <= 5000000000) {
      examples.push('Video file or application 🎬');
    }
    
    // Memory comparisons
    if (bytes >= 1024 && bytes <= 1048576) {
      const pages = Math.round(bytes / 4096);
      examples.push(`${pages} memory page${pages !== 1 ? 's' : ''} 📋`);
    }
    
    // Network transfer times (at 100 Mbps)
    const transferTimeSeconds = bytes / (100 * 125000); // 100 Mbps = 12.5 MB/s
    if (transferTimeSeconds > 0.001 && transferTimeSeconds < 3600) {
      if (transferTimeSeconds < 1) {
        examples.push(`${(transferTimeSeconds * 1000).toFixed(0)}ms download @100Mbps 📡`);
      } else if (transferTimeSeconds < 60) {
        examples.push(`${transferTimeSeconds.toFixed(1)}s download @100Mbps 📡`);
      } else {
        examples.push(`${(transferTimeSeconds / 60).toFixed(1)}min download @100Mbps 📡`);
      }
    }
    
    // Array sizes
    if (bytes >= 4 && bytes <= 1000000000) {
      const ints = Math.floor(bytes / 4);
      if (ints < 1000000) {
        examples.push(`${ints.toLocaleString()} integers array 🔢`);
      }
    }
    
    return examples.slice(0, 2); // Show max 2 examples
  }, []);

  // Group units by category for better UX
  const unitsByCategory = useMemo(() => {
    const categories: { [key: string]: Array<[string, typeof UNIT_LABELS[keyof typeof UNIT_LABELS]]> } = {};
    
    Object.entries(UNIT_LABELS).forEach(([unit, label]) => {
      if (!categories[label.category]) {
        categories[label.category] = [];
      }
      categories[label.category].push([unit, label]);
    });
    
    return categories;
  }, []);

  return (
    <div className="h-full w-full bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 overflow-auto">
      <div className="container mx-auto px-6 py-8 max-w-6xl min-h-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center justify-center">
            <ServerIcon className="w-8 h-8 mr-3 text-blue-600" />
            Size Units Converter
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Convert between data sizes with programming context and smart precision
          </p>
        </div>

        {/* Quick Info Panel */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <ComputerDesktopIcon className="w-5 h-5 text-blue-500 mr-2" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Quick Reference:</span>
            </div>
            <div className="flex space-x-4 text-sm">
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">1 KiB</div>
                <div className="font-mono text-gray-900 dark:text-white">1,024 bytes</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">1 KB</div>
                <div className="font-mono text-gray-900 dark:text-white">1,000 bytes</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">1 Byte</div>
                <div className="font-mono text-gray-900 dark:text-white">8 bits</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Converter */}
          <div className="lg:col-span-2 space-y-6">
            {/* Presets */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <SparklesIcon className="w-5 h-5 mr-2 text-blue-600" />
                  Programming Presets
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                  {PRESETS.map((preset, index) => (
                    <button
                      key={index}
                      onClick={() => applyPreset(preset)}
                      className="p-3 text-left bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors"
                    >
                      <div className="text-sm font-medium text-blue-900 dark:text-blue-300">
                        {preset.name}
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        {typeof preset.value === 'function' ? preset.value() : preset.value} {UNIT_LABELS[preset.fromUnit as keyof typeof UNIT_LABELS]?.symbol}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Converter */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <ArrowsRightLeftIcon className="w-5 h-5 mr-2 text-green-600" />
                  Size Converter
                </h3>
              </div>
              <div className="p-6 space-y-6">
                {/* From Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    From
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="number"
                      value={state.inputValue || ''}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-lg font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter value..."
                      min="0"
                      step="any"
                    />
                    <select
                      value={state.fromUnit || 'bytes'}
                      onChange={(e) => handleFromUnitChange(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      aria-label="Select source size unit"
                    >
                      {Object.entries(unitsByCategory).map(([category, units]) => (
                        <optgroup key={category} label={category}>
                          {units.map(([unit, label]) => (
                            <option key={unit} value={unit}>
                              {label.icon} {label.name} ({label.symbol})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Swap Button */}
                <div className="flex justify-center">
                  <button
                    onClick={swapUnits}
                    className="p-3 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                    title="Swap units"
                  >
                    <ArrowsRightLeftIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* To Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    To
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <input
                        type="text"
                        value={state.outputValue || ''}
                        readOnly
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-lg font-mono bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white pr-12"
                        placeholder="Result..."
                      />
                      {state.outputValue && (
                        <button
                          onClick={() => copyToClipboard(state.outputValue)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          title="Copy result"
                        >
                          {state.copySuccess ? (
                            <CheckIcon className="w-5 h-5 text-green-500" />
                          ) : (
                            <ClipboardDocumentIcon className="w-5 h-5" />
                          )}
                        </button>
                      )}
                    </div>
                    <select
                      value={state.toUnit || 'kilobytes'}
                      onChange={(e) => handleToUnitChange(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      aria-label="Select target size unit"
                    >
                      {Object.entries(unitsByCategory).map(([category, units]) => (
                        <optgroup key={category} label={category}>
                          {units.map(([unit, label]) => (
                            <option key={unit} value={unit}>
                              {label.icon} {label.name} ({label.symbol})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Real-world Context */}
                {state.inputValue && state.outputValue && state.showContext && (
                  <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="text-sm font-medium text-green-900 dark:text-green-300 mb-2 flex items-center">
                      <InformationCircleIcon className="w-4 h-4 mr-2" />
                      Programming Context
                    </h4>
                    {(() => {
                      const value = parseFloat(state.inputValue);
                      const context = getRealWorldContext(value, state.fromUnit);
                      const examples = getPracticalExamples(value, state.fromUnit);
                      
                      return (
                        <div className="space-y-2">
                          <p className="text-sm text-green-800 dark:text-green-300">
                            <span className="mr-2">{context.icon}</span>
                            {context.text}
                          </p>
                          {examples.length > 0 && (
                            <div className="text-sm text-green-700 dark:text-green-400">
                              <strong>Equivalent to:</strong> {examples.join(' • ')}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-between">
                  <button
                    onClick={clearAll}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center"
                  >
                    <TrashIcon className="w-4 h-4 mr-2" />
                    Clear
                  </button>
                  <button
                    onClick={() => setState({ showContext: !state.showContext })}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center ${
                      state.showContext
                        ? 'bg-green-500 hover:bg-green-600 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <InformationCircleIcon className="w-4 h-4 mr-2" />
                    Context
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* History Sidebar */}
          <div className="space-y-6">
            {/* Conversion History */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <ServerIcon className="w-5 h-5 mr-2 text-purple-600" />
                  Recent Conversions
                </h3>
              </div>
              <div className="p-6">
                {state.history && state.history.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto" ref={historyRef}>
                    {state.history.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                        onClick={() => {
                          setState({ 
                            inputValue: item.value.toString(),
                            fromUnit: item.fromUnit,
                            toUnit: item.toUnit,
                            outputValue: item.result.toString()
                          });
                        }}
                      >
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.value} {UNIT_LABELS[item.fromUnit as keyof typeof UNIT_LABELS]?.symbol}
                          <ArrowsRightLeftIcon className="w-3 h-3 inline mx-2" />
                          {item.result} {UNIT_LABELS[item.toUnit as keyof typeof UNIT_LABELS]?.symbol}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-8">
                    No conversions yet. Start converting to see history!
                  </p>
                )}
              </div>
            </div>

            {/* Unit Reference */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <CloudIcon className="w-5 h-5 mr-2 text-orange-600" />
                  Unit Reference
                </h3>
              </div>
              <div className="p-6">
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {Object.entries(unitsByCategory).map(([category, units]) => (
                    <div key={category}>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {category}
                      </h4>
                      <div className="space-y-1 ml-2">
                        {units.slice(0, 4).map(([unit, label]) => (
                          <div key={unit} className="flex justify-between items-center text-xs">
                            <span className="text-gray-600 dark:text-gray-400">
                              {label.icon} {label.name}
                            </span>
                            <span className="text-gray-500 dark:text-gray-500 font-mono">
                              {label.symbol}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SizeUnits;
