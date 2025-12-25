import React, { useEffect } from 'react';
import { BaseToolProps } from '../types';
import { useToolState } from '../../../hooks/useToolState';
import MonacoDiffEditor from '../../common/editor/MonacoDiffEditor';
import {
  DocumentDuplicateIcon,
  ClipboardDocumentIcon,
  TrashIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';

interface TextCompareState {
  leftText: string;
  rightText: string;
  error: string | null;
  copySuccess: boolean;
}

const TextCompareTool: React.FC<BaseToolProps> = (props) => {
  const { state, setState } = useToolState(props);

  // Initialize state
  useEffect(() => {
    if (state.leftText === undefined && state.rightText === undefined) {
      setState({
        leftText: '',
        rightText: '',
        error: null,
        copySuccess: false,
      });
    }
  }, []);

  const pasteFromClipboard = async (side: 'left' | 'right') => {
    try {
      const text = await navigator.clipboard.readText();
      if (side === 'left') {
        setState({ leftText: text, error: null });
      } else {
        setState({ rightText: text, error: null });
      }
    } catch (err) {
      setState({ error: 'Failed to read from clipboard.' });
    }
  };

  const swapTexts = () => {
    setState({
      leftText: state.rightText || '',
      rightText: state.leftText || ''
    });
  };

  const clearAll = () => {
    setState({
      leftText: '',
      rightText: '',
      error: null
    });
  };

  return (
    <div className="h-full w-full bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 overflow-hidden flex flex-col">
      <div className="container mx-auto px-4 py-8 max-w-full h-full flex flex-col">
        {/* Header */}
        <div className="text-center mb-6 flex-shrink-0">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center justify-center">
            <DocumentDuplicateIcon className="w-8 h-8 mr-3 text-green-600" />
            Text Compare Tool
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Compare two texts side-by-side with character-level differences
          </p>
        </div>

        {/* Error Display */}
        {state.error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex-shrink-0">
            <p className="text-red-700 dark:text-red-300">{state.error}</p>
          </div>
        )}

        {/* Controls */}
        <div className="mb-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 flex-shrink-0">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {/* Left side controls */}
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Original:</span>
                <button
                  onClick={() => pasteFromClipboard('left')}
                  className="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors flex items-center"
                >
                  <ClipboardDocumentIcon className="w-4 h-4 mr-1" />
                  Paste
                </button>
                <button
                  onClick={() => setState({ leftText: '' })}
                  className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center"
                >
                  <TrashIcon className="w-4 h-4 mr-1" />
                  Clear
                </button>
              </div>

              {/* Swap button */}
              <button
                onClick={swapTexts}
                className="flex items-center space-x-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                title="Swap left and right texts"
              >
                <ArrowsRightLeftIcon className="w-4 h-4" />
                <span>Swap</span>
              </button>

              {/* Right side controls */}
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Modified:</span>
                <button
                  onClick={() => pasteFromClipboard('right')}
                  className="px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-md hover:bg-green-200 dark:hover:bg-green-800 transition-colors flex items-center"
                >
                  <ClipboardDocumentIcon className="w-4 h-4 mr-1" />
                  Paste
                </button>
                <button
                  onClick={() => setState({ rightText: '' })}
                  className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center"
                >
                  <TrashIcon className="w-4 h-4 mr-1" />
                  Clear
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Clear all */}
              <button
                onClick={clearAll}
                className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors flex items-center"
              >
                <TrashIcon className="w-4 h-4 mr-1" />
                Clear All
              </button>
            </div>
          </div>
        </div>

        {/* Diff Editor */}
        <div className="flex-1 min-h-0 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-lg bg-white dark:bg-gray-800">
          <MonacoDiffEditor
            original={state.leftText || ''}
            modified={state.rightText || ''}
            onOriginalChange={(value) => setState({ leftText: value })}
            onModifiedChange={(value) => setState({ rightText: value })}
            language="text"
            height="100%"
            originalEditable={true}
          />
        </div>
      </div>
    </div>
  );
};

export default TextCompareTool;