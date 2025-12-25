import React, { useRef, useCallback, useState, useEffect } from 'react';
import { BaseToolProps } from '../types';
import { useToolState } from '../../../hooks/useToolState';
import {
  ClockIcon,
  ArrowsRightLeftIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  TrashIcon,
  SparklesIcon,
  CalendarIcon,
  SunIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';


interface TimeUnitsState {
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

// Extended time units with more precision and variety
const TIME_UNITS = {
  nanoseconds: 0.000001,
  microseconds: 0.001,
  milliseconds: 1,
  seconds: 1000,
  minutes: 60000,
  hours: 3600000,
  days: 86400000,
  weeks: 604800000,
  months: 2629746000, // Average month (30.44 days)
  years: 31556952000, // Average year (365.2425 days)
  decades: 315569520000,
  centuries: 3155695200000,
  millennia: 31556952000000
};

const UNIT_LABELS = {
  nanoseconds: { name: 'Nanoseconds', symbol: 'ns', icon: '⚡' },
  microseconds: { name: 'Microseconds', symbol: 'μs', icon: '🔬' },
  milliseconds: { name: 'Milliseconds', symbol: 'ms', icon: '⏱️' },
  seconds: { name: 'Seconds', symbol: 's', icon: '⏰' },
  minutes: { name: 'Minutes', symbol: 'min', icon: '⏲️' },
  hours: { name: 'Hours', symbol: 'h', icon: '🕐' },
  days: { name: 'Days', symbol: 'd', icon: '📅' },
  weeks: { name: 'Weeks', symbol: 'w', icon: '📆' },
  months: { name: 'Months', symbol: 'mo', icon: '🗓️' },
  years: { name: 'Years', symbol: 'y', icon: '🎂' },
  decades: { name: 'Decades', symbol: 'dec', icon: '📊' },
  centuries: { name: 'Centuries', symbol: 'c', icon: '🏛️' },
  millennia: { name: 'Millennia', symbol: 'mil', icon: '🌍' }
};

// Common conversion presets
const PRESETS = [
  { name: 'Unix Timestamp Now', fromUnit: 'seconds', value: () => Math.floor(Date.now() / 1000) },
  { name: 'Millisecond Timestamp Now', fromUnit: 'milliseconds', value: () => Date.now() },
  { name: 'Work Day', fromUnit: 'hours', value: () => 8 },
  { name: 'Work Week', fromUnit: 'hours', value: () => 40 },
  { name: 'Average Human Lifespan', fromUnit: 'years', value: () => 79 },
  { name: 'Movie Length', fromUnit: 'minutes', value: () => 120 },
  { name: 'Song Length', fromUnit: 'minutes', value: () => 3.5 }
];

const TimeUnits: React.FC<BaseToolProps> = (props) => {
  const { state, setState } = useToolState(props);

  const historyRef = useRef<HTMLDivElement>(null);
  const historyDataRef = useRef<ConversionHistoryItem[]>([]);
  const setStateRef = useRef(setState);

  // Sync refs with state/props
  useEffect(() => {
    historyDataRef.current = state.history || [];
  }, [state.history]);

  useEffect(() => {
    setStateRef.current = setState;
  }, [setState]);

  // Initialize state
  useEffect(() => {
    if (!state.fromUnit) {
      setState({
        inputValue: '',
        outputValue: '',
        fromUnit: 'seconds',
        toUnit: 'minutes',
        copySuccess: false,
        history: [],
        favorites: ['seconds', 'minutes', 'hours', 'days'],
        showContext: true,
        currentTimestamp: Date.now()
      });
    }
  }, [state.fromUnit, setState]);

  // Update current timestamp every second
  useEffect(() => {
    const interval = setInterval(() => {
      setState({ currentTimestamp: Date.now() });
    }, 1000);
    return () => clearInterval(interval);
  }, [setState]);

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

  // Convert time with smart precision
  const convertTime = useCallback((value: number, fromUnit: string, toUnit: string) => {
    if (isNaN(value) || value < 0) return '';

    const fromMs = TIME_UNITS[fromUnit as keyof typeof TIME_UNITS];
    const toMs = TIME_UNITS[toUnit as keyof typeof TIME_UNITS];

    if (!fromMs || !toMs) return '';

    const milliseconds = value * fromMs;
    const result = milliseconds / toMs;
    const precision = getSmartPrecision(result, toUnit);

    return result.toFixed(precision);
  }, [getSmartPrecision]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setState({ inputValue });

    const value = parseFloat(inputValue);
    if (!isNaN(value) && value >= 0) {
      const result = convertTime(value, state.fromUnit, state.toUnit);
      setState({ outputValue: result });
    } else {
      setState({ outputValue: '' });
    }
  }, [convertTime, setState, state.fromUnit, state.toUnit]);

  // Handle unit changes
  const handleFromUnitChange = useCallback((unit: string) => {
    setState({ fromUnit: unit });
    const value = parseFloat(state.inputValue);
    if (!isNaN(value) && value >= 0) {
      const result = convertTime(value, unit, state.toUnit);
      setState({ outputValue: result });
    }
  }, [convertTime, setState, state.inputValue, state.toUnit]);

  const handleToUnitChange = useCallback((unit: string) => {
    setState({ toUnit: unit });
    const value = parseFloat(state.inputValue);
    if (!isNaN(value) && value >= 0) {
      const result = convertTime(value, state.fromUnit, unit);
      setState({ outputValue: result });
    }
  }, [convertTime, setState, state.inputValue, state.fromUnit]);

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
      const result = convertTime(value, newFromUnit, newToUnit);
      setState({ outputValue: result });
    }
  }, [convertTime, setState, state.fromUnit, state.toUnit, state.outputValue]);

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

    const newHistory = [historyItem, ...historyDataRef.current].slice(0, 10); // Keep last 10
    setStateRef.current({ history: newHistory });
  }, []);

  // Ref to hold current state for timeout callback
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Apply conversion and add to history
  const applyConversion = useCallback(() => {
    const currentState = stateRef.current;
    const value = parseFloat(currentState.inputValue);
    const result = parseFloat(currentState.outputValue);

    if (!isNaN(value) && !isNaN(result) && value >= 0) {
      // Avoid adding duplicate history items
      const lastItem = historyDataRef.current[0];
      if (lastItem &&
        lastItem.value === value &&
        lastItem.fromUnit === currentState.fromUnit &&
        lastItem.toUnit === currentState.toUnit) {
        return;
      }
      addToHistory(value, currentState.fromUnit, currentState.toUnit, result);
    }
  }, [addToHistory]);

  // Apply conversion when output changes
  useEffect(() => {
    if (state.outputValue && state.inputValue) {
      const timeoutId = setTimeout(applyConversion, 1000); // Add to history after 1 second of no changes
      return () => clearTimeout(timeoutId);
    }
  }, [state.outputValue, state.inputValue, applyConversion]);

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

    const result = convertTime(value, preset.fromUnit, state.toUnit);
    setState({ outputValue: result });
  }, [convertTime, setState, state.toUnit]);

  // Clear all
  const clearAll = useCallback(() => {
    setState({
      inputValue: '',
      outputValue: '',
      history: []
    });
  }, [setState]);

  // Get real-world context
  const getRealWorldContext = useCallback((value: number, unit: string) => {
    const contexts: Array<{ condition: (ms: number) => boolean; text: string; icon: string }> = [
      { condition: (ms) => ms < 1, text: 'Faster than a computer can process', icon: '💻' },
      { condition: (ms) => ms < 100, text: 'About as fast as a blink of an eye', icon: '👁️' },
      { condition: (ms) => ms < 1000, text: 'Quicker than a heartbeat', icon: '💓' },
      { condition: (ms) => ms < 60000, text: 'Less than a minute', icon: '⏱️' },
      { condition: (ms) => ms < 3600000, text: 'Part of an hour', icon: '🕐' },
      { condition: (ms) => ms < 86400000, text: 'Part of a day', icon: '☀️' },
      { condition: (ms) => ms < 604800000, text: 'Part of a week', icon: '📅' },
      { condition: (ms) => ms < 2629746000, text: 'Part of a month', icon: '🗓️' },
      { condition: (ms) => ms < 31556952000, text: 'Part of a year', icon: '🎂' },
      { condition: (ms) => ms < 315569520000, text: 'Multiple years', icon: '📊' },
      { condition: (ms) => ms >= 315569520000, text: 'A significant portion of human history', icon: '🏛️' }
    ];

    const milliseconds = value * TIME_UNITS[unit as keyof typeof TIME_UNITS];
    const context = contexts.find(c => c.condition(milliseconds));

    return context || { text: 'An extremely long time', icon: '🌌' };
  }, []);

  // Get practical examples
  const getPracticalExamples = useCallback((value: number, unit: string) => {
    const milliseconds = value * TIME_UNITS[unit as keyof typeof TIME_UNITS];
    const examples = [];

    // Heartbeats (average 70 bpm)
    const heartbeats = Math.round(milliseconds / (60000 / 70));
    if (heartbeats > 0 && heartbeats < 1000000) {
      examples.push(`${heartbeats.toLocaleString()} heartbeats 💓`);
    }

    // Blinks (average 17 per minute)
    const blinks = Math.round(milliseconds / (60000 / 17));
    if (blinks > 0 && blinks < 100000) {
      examples.push(`${blinks.toLocaleString()} eye blinks 👁️`);
    }

    // Movies (average 2 hours)
    const movies = milliseconds / (2 * 3600000);
    if (movies >= 0.1 && movies < 1000) {
      examples.push(`${movies.toFixed(1)} movies 🎬`);
    }

    // Songs (average 3.5 minutes)
    const songs = milliseconds / (3.5 * 60000);
    if (songs >= 0.1 && songs < 10000) {
      examples.push(`${Math.round(songs)} songs 🎵`);
    }

    return examples.slice(0, 2); // Show max 2 examples
  }, []);

  return (
    <div className="h-full w-full bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 overflow-auto">
      <div className="container mx-auto px-6 py-8 max-w-6xl min-h-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center justify-center">
            <ClockIcon className="w-8 h-8 mr-3 text-purple-600" />
            Time Units Converter
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Convert between time units with real-world context and smart precision
          </p>
        </div>

        {/* Current Timestamp Display */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <SunIcon className="w-5 h-5 text-yellow-500 mr-2" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Time:</span>
            </div>
            <div className="flex space-x-4 text-sm">
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">Unix Timestamp</div>
                <div className="font-mono text-gray-900 dark:text-white">
                  {state.currentTimestamp ? Math.floor(state.currentTimestamp / 1000) : '--'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">Milliseconds</div>
                <div className="font-mono text-gray-900 dark:text-white">
                  {state.currentTimestamp || '--'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">Human Time</div>
                <div className="font-mono text-gray-900 dark:text-white">
                  {state.currentTimestamp ? new Date(state.currentTimestamp).toLocaleTimeString() : '--:--:--'}
                </div>
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
                  <SparklesIcon className="w-5 h-5 mr-2 text-purple-600" />
                  Quick Presets
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {PRESETS.map((preset, index) => (
                    <button
                      key={index}
                      onClick={() => applyPreset(preset)}
                      className="p-3 text-left bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg border border-purple-200 dark:border-purple-800 transition-colors"
                    >
                      <div className="text-sm font-medium text-purple-900 dark:text-purple-300">
                        {preset.name}
                      </div>
                      <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                        {typeof preset.value === 'function' ? 'Dynamic' : preset.value} {UNIT_LABELS[preset.fromUnit as keyof typeof UNIT_LABELS]?.symbol}
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
                  <ArrowsRightLeftIcon className="w-5 h-5 mr-2 text-blue-600" />
                  Time Converter
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
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-lg font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter value..."
                      min="0"
                      step="any"
                    />
                    <select
                      value={state.fromUnit || 'seconds'}
                      onChange={(e) => handleFromUnitChange(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      aria-label="Select source time unit"
                    >
                      {Object.entries(UNIT_LABELS).map(([unit, label]) => (
                        <option key={unit} value={unit}>
                          {label.icon} {label.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Swap Button */}
                <div className="flex justify-center">
                  <button
                    onClick={swapUnits}
                    className="p-3 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
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
                      value={state.toUnit || 'minutes'}
                      onChange={(e) => handleToUnitChange(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      aria-label="Select target time unit"
                    >
                      {Object.entries(UNIT_LABELS).map(([unit, label]) => (
                        <option key={unit} value={unit}>
                          {label.icon} {label.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Real-world Context */}
                {state.inputValue && state.outputValue && state.showContext && (
                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2 flex items-center">
                      <InformationCircleIcon className="w-4 h-4 mr-2" />
                      Real-World Context
                    </h4>
                    {(() => {
                      const value = parseFloat(state.inputValue);
                      const context = getRealWorldContext(value, state.fromUnit);
                      const examples = getPracticalExamples(value, state.fromUnit);

                      return (
                        <div className="space-y-2">
                          <p className="text-sm text-blue-800 dark:text-blue-300">
                            <span className="mr-2">{context.icon}</span>
                            {context.text}
                          </p>
                          {examples.length > 0 && (
                            <div className="text-sm text-blue-700 dark:text-blue-400">
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
                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center ${state.showContext
                      ? 'bg-blue-500 hover:bg-blue-600 text-white'
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
                  <ClockIcon className="w-5 h-5 mr-2 text-green-600" />
                  Recent Conversions
                </h3>
              </div>
              <div className="p-6">
                {state.history && state.history.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto" ref={historyRef}>
                    {state.history.map((item: ConversionHistoryItem) => (
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
                  <CalendarIcon className="w-5 h-5 mr-2 text-orange-600" />
                  Unit Reference
                </h3>
              </div>
              <div className="p-6">
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {Object.entries(UNIT_LABELS).map(([unit, label]) => (
                    <div key={unit} className="flex justify-between items-center text-sm">
                      <span className="text-gray-700 dark:text-gray-300">
                        {label.icon} {label.name}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 font-mono">
                        {label.symbol}
                      </span>
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

export default TimeUnits;