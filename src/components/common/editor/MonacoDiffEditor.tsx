import { FC, useRef, useEffect, useState, useMemo } from 'react';
import { DiffEditor, DiffOnMount } from '@monaco-editor/react';
import { useTheme, onThemeChange } from '../../../hooks/useTheme';

interface MonacoDiffEditorProps {
    original: string;
    modified: string;
    onOriginalChange?: (value: string) => void;
    onModifiedChange?: (value: string) => void;
    language?: string;
    readOnly?: boolean;
    height?: string | number;
    theme?: 'vs-dark' | 'light';
    originalEditable?: boolean;
}

// Normalize theme values
const normalizeTheme = (theme: string): 'vs-dark' | 'vs-light' => {
    if (theme === 'vs-dark' || theme === 'vs-light') {
        return theme;
    }
    return theme === 'dark' ? 'vs-dark' : 'vs-light';
};

const MonacoDiffEditor: FC<MonacoDiffEditorProps> = ({
    original,
    modified,
    onOriginalChange,
    onModifiedChange,
    language = 'text',
    readOnly = false,
    height = '1000px',
    theme: propTheme,
    originalEditable = true,
}) => {
    const diffEditorRef = useRef<any>(null);
    const { theme: systemTheme } = useTheme();

    // Track the current theme state
    const [currentThemeState, setCurrentThemeState] = useState(() => {
        const normalizedPropTheme = propTheme ? normalizeTheme(propTheme) : null;
        const normalizedSystemTheme = normalizeTheme(systemTheme);
        return normalizedPropTheme || normalizedSystemTheme;
    });

    // Listen for theme changes
    useEffect(() => {
        const cleanup = onThemeChange((newTheme) => {
            const normalizedTheme = normalizeTheme(newTheme);
            setCurrentThemeState(normalizedTheme);
        });

        return cleanup;
    }, []);

    const handleEditorDidMount: DiffOnMount = (editor, monaco) => {
        diffEditorRef.current = editor;

        // Get models to listen for changes
        const originalModel = editor.getOriginalEditor().getModel();
        const modifiedModel = editor.getModifiedEditor().getModel();

        if (originalModel && onOriginalChange) {
            originalModel.onDidChangeContent(() => {
                onOriginalChange(originalModel.getValue());
            });
        }

        if (modifiedModel && onModifiedChange) {
            modifiedModel.onDidChangeContent(() => {
                onModifiedChange(modifiedModel.getValue());
            });
        }
    };

    return (
        <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 h-full">
            <DiffEditor
                height={height}
                language={language}
                original={original}
                modified={modified}
                theme={currentThemeState}
                options={{
                    readOnly,
                    originalEditable,
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    roundedSelection: true,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    padding: { top: 8 },
                    contextmenu: true,
                    selectOnLineNumbers: true,
                    renderSideBySide: true,
                    diffWordWrap: 'off',
                }}
                onMount={handleEditorDidMount}
            />
        </div>
    );
};

export default MonacoDiffEditor;
