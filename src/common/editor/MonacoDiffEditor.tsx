import React, { memo } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { useTheme } from '../../hooks/useTheme';

interface MonacoDiffEditorProps {
  original: string;
  modified: string;
  language?: string;
  height?: string | number;
  options?: any;
  onMount?: (editor: any, monaco: any) => void;
  theme?: string;
}

// Normalize theme values
const normalizeTheme = (theme: string): 'vs-dark' | 'vs-light' => {
  if (theme === 'vs-dark' || theme === 'vs-light') {
    return theme;
  }
  return theme === 'dark' ? 'vs-dark' : 'vs-light';
};

export default memo(function MonacoDiffEditor({
  height = '400px',
  language = 'text',
  original = '',
  modified = '',
  theme: propTheme,
  onMount,
  options = {},
  ...props
}: MonacoDiffEditorProps) {
  const { theme: systemTheme } = useTheme();
  const monacoTheme = propTheme ? normalizeTheme(propTheme) : normalizeTheme(systemTheme);

  const defaultOptions = {
    readOnly: false,
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: 'on',
    roundedSelection: true,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    padding: { top: 8 },
    contextmenu: true,
    selectOnLineNumbers: true,
    selectionClipboard: true,
    copyWithSyntaxHighlighting: true,
    renderSideBySide: true,
    ignoreTrimWhitespace: false,
    renderWhitespace: 'selection',
    diffWordWrap: 'on',
    enableSplitViewResizing: true,
    renderIndicators: true,
    ...options
  };

  const handleMount = (editor: any, monaco: any) => {
    if (monacoTheme) {
      monaco.editor.setTheme(monacoTheme);
    }
    onMount?.(editor, monaco);
  };

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      <DiffEditor
        height={height}
        language={language}
        original={original}
        modified={modified}
        theme={monacoTheme}
        options={defaultOptions}
        onMount={handleMount}
      />
    </div>
  );
}); 