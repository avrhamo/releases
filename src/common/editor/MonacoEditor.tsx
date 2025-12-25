import React, { useRef, useEffect, memo } from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from '@/hooks/use-theme';

interface MonacoEditorProps {
  value: string;
  onChange?: (value: string | undefined) => void;
  language?: string;
  theme?: string;
  height?: string;
  options?: any;
  onMount?: (editor: any, monaco: any) => void;
}

// Map app theme to Monaco theme
const mapTheme = (theme?: string) => {
  if (theme === 'dark' || theme === 'vs-dark') return 'vs-dark';
  if (theme === 'light' || theme === 'vs-light') return 'vs-light';
  return 'vs-dark'; // default
};

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  onChange,
  language = 'javascript',
  theme = 'vs-dark',
  height = '100%',
  options = {},
  onMount
}) => {
  const monacoRef = useRef<any>(null);
  const mappedTheme = mapTheme(theme);

  // Store monaco namespace and set theme on mount
  const handleMount = (editor: any, monaco: any) => {
    monacoRef.current = monaco;
    if (mappedTheme) {
      monaco.editor.setTheme(mappedTheme);
    }
    onMount?.(editor, monaco);
  };

  // Update theme when prop changes
  useEffect(() => {
    if (monacoRef.current && mappedTheme) {
      monacoRef.current.editor.setTheme(mappedTheme);
    }
  }, [mappedTheme]);

  useEffect(() => {
  });

  return (
    <Editor
      key={mappedTheme}
      height={height}
      defaultLanguage={language}
      value={value}
      theme={mappedTheme}
      onChange={onChange}
      options={{
        minimap: { enabled: false },
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        ...options
      }}
      onMount={handleMount}
    />
  );
}; 
export default memo(MonacoEditor);