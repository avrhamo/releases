import React, { useState, useEffect, useMemo } from 'react';
import { Tab } from '@headlessui/react';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClipboardDocumentIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  BookOpenIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  LightBulbIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  PlayIcon
} from '@heroicons/react/24/outline';

interface RegexMatch {
  match: string;
  index: number;
  groups: string[];
  namedGroups?: { [key: string]: string };
}

interface RegexState {
  pattern: string;
  flags: {
    global: boolean;
    ignoreCase: boolean;
    multiline: boolean;
    dotAll: boolean;
    unicode: boolean;
    sticky: boolean;
  };
  testString: string;
  replacement: string;
  matches: RegexMatch[];
  error: string | null;
  isValid: boolean;
}

const RegexTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const [state, setState] = useState<RegexState>({
    pattern: '',
    flags: {
      global: true,
      ignoreCase: false,
      multiline: false,
      dotAll: false,
      unicode: false,
      sticky: false
    },
    testString: '',
    replacement: '',
    matches: [],
    error: null,
    isValid: false
  });

  // Common regex patterns for quick access
  const commonPatterns = [
    { name: 'Email', pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', description: 'Basic email validation' },
    { name: 'Phone (US)', pattern: '\\(\\d{3}\\)\\s?\\d{3}-\\d{4}', description: 'US phone number format' },
    { name: 'URL', pattern: 'https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)', description: 'HTTP/HTTPS URLs' },
    { name: 'IPv4', pattern: '\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b', description: 'IPv4 address' },
    { name: 'Date (MM/DD/YYYY)', pattern: '(0[1-9]|1[0-2])\\/(0[1-9]|[12][0-9]|3[01])\\/(19|20)\\d\\d', description: 'Date in MM/DD/YYYY format' },
    { name: 'Hex Color', pattern: '#[0-9A-Fa-f]{6}\\b', description: 'Hexadecimal color code' },
    { name: 'Credit Card', pattern: '\\b(?:\\d{4}[-\\s]?){3}\\d{4}\\b', description: 'Credit card number format' },
    { name: 'Social Security', pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b', description: 'US Social Security Number' }
  ];

  const flagsString = useMemo(() => {
    const flags = [];
    if (state.flags.global) flags.push('g');
    if (state.flags.ignoreCase) flags.push('i');
    if (state.flags.multiline) flags.push('m');
    if (state.flags.dotAll) flags.push('s');
    if (state.flags.unicode) flags.push('u');
    if (state.flags.sticky) flags.push('y');
    return flags.join('');
  }, [state.flags]);

  const processRegex = (pattern: string, testString: string, flags: typeof state.flags) => {
    try {
      if (!pattern) {
        setState(prev => ({ ...prev, matches: [], error: null, isValid: false }));
        return;
      }

      const flagStr = Object.entries(flags)
        .filter(([_, value]) => value)
        .map(([key]) => {
          switch (key) {
            case 'global': return 'g';
            case 'ignoreCase': return 'i';
            case 'multiline': return 'm';
            case 'dotAll': return 's';
            case 'unicode': return 'u';
            case 'sticky': return 'y';
            default: return '';
          }
        })
        .join('');

      const regex = new RegExp(pattern, flagStr);
      const matches: RegexMatch[] = [];

      if (flags.global) {
        let match;
        while ((match = regex.exec(testString)) !== null) {
          matches.push({
            match: match[0],
            index: match.index,
            groups: Array.from(match).slice(1),
            namedGroups: match.groups
          });
          if (!flags.global) break;
        }
      } else {
        const match = regex.exec(testString);
        if (match) {
          matches.push({
            match: match[0],
            index: match.index,
            groups: Array.from(match).slice(1),
            namedGroups: match.groups
          });
        }
      }

      setState(prev => ({ 
        ...prev, 
        matches, 
        error: null, 
        isValid: true 
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        matches: [], 
        error: error instanceof Error ? error.message : 'Invalid regex pattern',
        isValid: false 
      }));
    }
  };

  useEffect(() => {
    processRegex(state.pattern, state.testString, state.flags);
  }, [state.pattern, state.testString, state.flags]);

  const highlightMatches = (text: string, matches: RegexMatch[]) => {
    if (!matches.length) return text;

    let highlightedText = '';
    let lastIndex = 0;

    matches.forEach((match, matchIndex) => {
      // Add text before match
      highlightedText += text.substring(lastIndex, match.index);
      
      // Add highlighted match
      highlightedText += `<span class="bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 px-1 rounded font-semibold" title="Match ${matchIndex + 1}">${match.match}</span>`;
      
      lastIndex = match.index + match.match.length;
    });

    // Add remaining text
    highlightedText += text.substring(lastIndex);
    
    return highlightedText;
  };

  const performReplacement = () => {
    if (!state.pattern || !state.replacement) return state.testString;
    
    try {
      const regex = new RegExp(state.pattern, flagsString);
      return state.testString.replace(regex, state.replacement);
    } catch {
      return 'Error: Invalid pattern or replacement';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePatternSelect = (pattern: string) => {
    setState(prev => ({ ...prev, pattern }));
  };

  const handleFlagChange = (flag: keyof typeof state.flags) => {
    setState(prev => ({
      ...prev,
      flags: {
        ...prev.flags,
        [flag]: !prev.flags[flag]
      }
    }));
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-purple-50 to-pink-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center">
          <MagnifyingGlassIcon className="h-8 w-8 text-purple-600 dark:text-purple-400 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Regex Tool</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Test, validate, and replace with regular expressions</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <Tab.Group selectedIndex={activeTab} onChange={setActiveTab}>
          <Tab.List className="flex space-x-1 rounded-xl bg-white dark:bg-gray-800 p-1 shadow-sm border border-gray-200 dark:border-gray-700 max-w-lg mx-auto">
            <Tab
              className={({ selected }) =>
                `flex-1 rounded-lg py-3 px-4 text-sm font-medium leading-5 transition-all duration-200 flex items-center justify-center space-x-2
                ${selected
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 shadow-md text-white transform scale-105'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'
                }`
              }
            >
              <PlayIcon className="h-4 w-4" />
              <span>Test</span>
            </Tab>
            <Tab
              className={({ selected }) =>
                `flex-1 rounded-lg py-3 px-4 text-sm font-medium leading-5 transition-all duration-200 flex items-center justify-center space-x-2
                ${selected
                  ? 'bg-gradient-to-r from-green-500 to-green-600 shadow-md text-white transform scale-105'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'
                }`
              }
            >
              <PencilSquareIcon className="h-4 w-4" />
              <span>Replace</span>
            </Tab>
            <Tab
              className={({ selected }) =>
                `flex-1 rounded-lg py-3 px-4 text-sm font-medium leading-5 transition-all duration-200 flex items-center justify-center space-x-2
                ${selected
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 shadow-md text-white transform scale-105'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'
                }`
              }
            >
              <BookOpenIcon className="h-4 w-4" />
              <span>Patterns</span>
            </Tab>
          </Tab.List>

          <Tab.Panels className="mt-6 flex-1">
            {/* Test Tab */}
            <Tab.Panel className="h-full">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full">
                {/* Pattern Input */}
                <div className="xl:col-span-1">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 h-full">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <CodeBracketIcon className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
                        <label className="text-lg font-semibold text-gray-900 dark:text-white">
                          Regex Pattern
                        </label>
                      </div>
                      {state.isValid && (
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                    
                    <div className="relative mb-4">
                      <div className="flex items-center">
                        <span className="text-gray-500 mr-2 font-mono text-lg">/</span>
                        <input
                          type="text"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white font-mono"
                          value={state.pattern}
                          onChange={(e) => setState(prev => ({ ...prev, pattern: e.target.value }))}
                          placeholder="Enter regex pattern..."
                        />
                        <span className="text-gray-500 ml-2 font-mono text-lg">/{flagsString}</span>
                      </div>
                    </div>

                    {/* Flags */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Flags
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(state.flags).map(([flag, enabled]) => (
                          <label key={flag} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={() => handleFlagChange(flag as keyof typeof state.flags)}
                              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 capitalize">
                              {flag === 'ignoreCase' ? 'Case Insensitive' : 
                               flag === 'dotAll' ? 'Dot All' : 
                               flag}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {state.error && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800">
                        <div className="flex items-center">
                          <XCircleIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                          <span className="text-sm">{state.error}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Test String Input */}
                <div className="xl:col-span-1">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 h-full">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <DocumentTextIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                        <label className="text-lg font-semibold text-gray-900 dark:text-white">
                          Test String
                        </label>
                      </div>
                      {state.testString && (
                        <button
                          onClick={() => copyToClipboard(state.testString)}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Copy test string"
                        >
                          <ClipboardDocumentIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    
                    <textarea
                      className="w-full h-64 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none font-mono text-sm"
                      value={state.testString}
                      onChange={(e) => setState(prev => ({ ...prev, testString: e.target.value }))}
                      placeholder="Enter text to test against your regex pattern..."
                    />

                    {copied && (
                      <div className="mt-3 text-sm text-green-600 dark:text-green-400 flex items-center">
                        <CheckCircleIcon className="h-4 w-4 mr-1" />
                        Copied to clipboard!
                      </div>
                    )}
                  </div>
                </div>

                {/* Results */}
                <div className="xl:col-span-1">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 h-full">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                        <MagnifyingGlassIcon className="h-5 w-5 text-green-500 mr-2" />
                        Results
                      </h3>
                      <div className="text-sm text-gray-500">
                        {state.matches.length} match{state.matches.length !== 1 ? 'es' : ''}
                      </div>
                    </div>

                    {state.pattern && state.testString ? (
                      <>
                        {/* Highlighted Text */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Highlighted Matches
                          </label>
                          <div 
                            className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg font-mono text-sm whitespace-pre-wrap border max-h-32 overflow-auto"
                            dangerouslySetInnerHTML={{ 
                              __html: highlightMatches(state.testString, state.matches) 
                            }}
                          />
                        </div>

                        {/* Match Details */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Match Details
                          </label>
                          <div className="space-y-2 max-h-48 overflow-auto">
                            {state.matches.length > 0 ? (
                              state.matches.map((match, index) => (
                                <div key={index} className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                  <div className="text-sm">
                                    <div className="font-semibold text-green-800 dark:text-green-200">
                                      Match {index + 1} (pos {match.index}): 
                                      <span className="font-mono ml-1">"{match.match}"</span>
                                    </div>
                                    {match.groups.length > 0 && (
                                      <div className="mt-1 text-green-700 dark:text-green-300">
                                        Groups: {match.groups.map((group, i) => (
                                          <span key={i} className="font-mono">
                                            ${i + 1}="{group}" 
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-8 text-gray-500">
                                <ExclamationTriangleIcon className="h-8 w-8 mx-auto mb-2" />
                                <p>No matches found</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <MagnifyingGlassIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-lg font-medium">Ready to Test</p>
                        <p className="text-sm">Enter a pattern and test string to see matches</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Tab.Panel>

            {/* Replace Tab */}
            <Tab.Panel className="h-full">
              <div className="max-w-4xl mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-8 flex items-center">
                    <PencilSquareIcon className="h-7 w-7 text-green-500 mr-3" />
                    Find and Replace
                  </h2>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          Search Pattern
                        </label>
                        <div className="flex items-center">
                          <span className="text-gray-500 mr-2 font-mono text-lg">/</span>
                          <input
                            type="text"
                            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white font-mono"
                            value={state.pattern}
                            onChange={(e) => setState(prev => ({ ...prev, pattern: e.target.value }))}
                            placeholder="Enter search pattern..."
                          />
                          <span className="text-gray-500 ml-2 font-mono text-lg">/{flagsString}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          Replacement
                        </label>
                        <input
                          type="text"
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white font-mono"
                          value={state.replacement}
                          onChange={(e) => setState(prev => ({ ...prev, replacement: e.target.value }))}
                          placeholder="Enter replacement text..."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          Input Text
                        </label>
                        <textarea
                          className="w-full h-32 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white resize-none font-mono text-sm"
                          value={state.testString}
                          onChange={(e) => setState(prev => ({ ...prev, testString: e.target.value }))}
                          placeholder="Enter text to perform find and replace..."
              />
            </div>
          </div>

                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          Result
                        </label>
                        <div className="relative">
                          <textarea
                            className="w-full h-64 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm dark:bg-gray-700 dark:text-white resize-none font-mono text-sm"
                            value={performReplacement()}
                            readOnly
                          />
                          <button
                            onClick={() => copyToClipboard(performReplacement())}
                            className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                            title="Copy result"
                          >
                            <ClipboardDocumentIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Replacement Guide */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Replacement Patterns</h5>
                        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                          <div><code>$&</code> - Entire match</div>
                          <div><code>$1, $2...</code> - Captured groups</div>
                          <div><code>$`</code> - Text before match</div>
                          <div><code>$'</code> - Text after match</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Tab.Panel>

            {/* Patterns Tab */}
            <Tab.Panel className="h-full">
              <div className="max-w-6xl mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-8 flex items-center">
                    <BookOpenIcon className="h-7 w-7 text-blue-500 mr-3" />
                    Common Regex Patterns
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {commonPatterns.map((item, index) => (
                      <div key={index} className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{item.name}</h3>
                          <button
                            onClick={() => handlePatternSelect(item.pattern)}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Use Pattern
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{item.description}</p>
                        <code className="block p-3 bg-white dark:bg-gray-900 rounded border text-sm font-mono text-gray-800 dark:text-gray-200 break-all">
                          {item.pattern}
                        </code>
                      </div>
                    ))}
                  </div>

                  {/* Regex Guide */}
                  <div className="mt-8 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                      <LightBulbIcon className="h-6 w-6 text-yellow-500 mr-2" />
                      Quick Reference
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Character Classes</h4>
                        <div className="text-sm space-y-1">
                          <div><code>.</code> - Any character</div>
                          <div><code>\d</code> - Digit (0-9)</div>
                          <div><code>\w</code> - Word character</div>
                          <div><code>\s</code> - Whitespace</div>
                          <div><code>[abc]</code> - Character set</div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Quantifiers</h4>
                        <div className="text-sm space-y-1">
                          <div><code>*</code> - 0 or more</div>
                          <div><code>+</code> - 1 or more</div>
                          <div><code>?</code> - 0 or 1</div>
                          <div><code>{`{n}`}</code> - Exactly n</div>
                          <div><code>{`{n,m}`}</code> - Between n and m</div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Anchors</h4>
                        <div className="text-sm space-y-1">
                          <div><code>^</code> - Start of string</div>
                          <div><code>$</code> - End of string</div>
                          <div><code>\b</code> - Word boundary</div>
                          <div><code>(?=...)</code> - Lookahead</div>
                          <div><code>(?!...)</code> - Negative lookahead</div>
                        </div>
                      </div>
            </div>
          </div>
        </div>
        </div>
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </div>
    </div>
  );
};

export default RegexTool;