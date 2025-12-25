import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { BaseToolProps } from '../types';
import { useToolState } from '../../../hooks/useToolState';
import {
  CodeBracketIcon,
  DocumentTextIcon,
  ClipboardDocumentIcon,
  ArrowsRightLeftIcon,
  PhotoIcon,
  DocumentIcon,
  SparklesIcon,
  DocumentArrowUpIcon,
  EyeIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import CodeEditor from '../../common/editor/MonacoEditor';
import { useTheme } from '../../../hooks/useTheme';

interface Base64State {
  textInput: string;
  textOutput: string;
  mode: 'encode' | 'decode';
  error: string | null;
  fileType: string | null;
  fileName: string | null;
  isProcessing: boolean;
  progress: number;
  progressMessage: string;
  copySuccess: boolean;
  useMonacoForInput: boolean;
  useMonacoForOutput: boolean;
  showFilePreview: boolean;
  showRawView: boolean;
}

const MONACO_SIZE_LIMIT = 50 * 1024; // 50KB limit for Monaco
const EDITOR_STABILITY_DELAY = 1000; // Longer delay for more stability
const FILE_PREVIEW_SIZE_LIMIT = 50 * 1024 * 1024; // 50MB limit for file previews (using Blob URLs)
const SAFE_PROCESSING_SIZE_LIMIT = 100 * 1024 * 1024; // 100MB limit for safe processing

const Base64: React.FC<BaseToolProps> = (props) => {
  const { state, setState } = useToolState(props);
  const { theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const editorStabilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pasteProcessingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const blobUrlsRef = useRef<string[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Initialize state
  useEffect(() => {
    if (!state.mode) {
      setState({
        mode: 'encode',
        textInput: '',
        textOutput: '',
        error: null,
        isProcessing: false,
        progress: 0,
        progressMessage: '',
        copySuccess: false,
        useMonacoForInput: true,
        useMonacoForOutput: true,
        showFilePreview: true,
        showRawView: false
      });
    }
  }, [state.mode, setState]);

  // Initialize Web Worker for large files
  useEffect(() => {
    try {
      if (typeof Worker !== 'undefined') {
        workerRef.current = new Worker('/workers/base64-worker.js');

        workerRef.current.onmessage = (e: MessageEvent) => {
          const { type, data } = e.data;

          switch (type) {
            case 'PROGRESS':
              setState({
                progress: data.progress,
                progressMessage: data.message
              });
              break;

            case 'ENCODE_COMPLETE':
              setState({
                textInput: data.result,
                isProcessing: false,
                progress: 0,
                progressMessage: '',
                fileName: data.fileName
              });
              break;

            case 'ERROR':
              setState({
                isProcessing: false,
                progress: 0,
                progressMessage: '',
                error: data.error
              });
              break;
          }
        };
      }
    } catch (error) {
      workerRef.current = null;
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (editorStabilityTimeoutRef.current) {
        clearTimeout(editorStabilityTimeoutRef.current);
      }
      if (pasteProcessingTimeoutRef.current) {
        clearTimeout(pasteProcessingTimeoutRef.current);
      }
      // Clean up blob URLs to prevent memory leaks
      blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      blobUrlsRef.current = [];
    };
  }, [setState]);

  // Stable editor selection logic
  const shouldUseMonaco = useCallback((content: string) => {
    if (!content) return true;
    return content.length < MONACO_SIZE_LIMIT;
  }, []);

  // Simplified editor type management
  const updateEditorTypes = useCallback((inputContent: string, outputContent: string) => {
    // Clear any existing timeout
    if (editorStabilityTimeoutRef.current) {
      clearTimeout(editorStabilityTimeoutRef.current);
    }

    const shouldInputUseMoanco = shouldUseMonaco(inputContent);
    const shouldOutputUseMoanco = shouldUseMonaco(outputContent);

    // Only update if there's an actual change needed
    if (state.useMonacoForInput !== shouldInputUseMoanco ||
      state.useMonacoForOutput !== shouldOutputUseMoanco) {

      // Use a timeout to debounce rapid changes
      editorStabilityTimeoutRef.current = setTimeout(() => {
        setState((prevState: Base64State) => ({
          ...prevState,
          useMonacoForInput: shouldInputUseMoanco,
          useMonacoForOutput: shouldOutputUseMoanco
        }));
      }, EDITOR_STABILITY_DELAY);
    }
  }, [shouldUseMonaco, setState, state.useMonacoForInput, state.useMonacoForOutput]);

  // Update editor types when content changes significantly
  const prevInputLengthRef = useRef<number>(0);
  const prevOutputLengthRef = useRef<number>(0);

  useEffect(() => {
    const inputContent = state.textInput || '';
    const outputContent = state.textOutput || '';
    const inputLength = inputContent.length;
    const outputLength = outputContent.length;

    // Only update if length crosses Monaco threshold boundaries
    const inputCrossedThreshold =
      (prevInputLengthRef.current < MONACO_SIZE_LIMIT && inputLength >= MONACO_SIZE_LIMIT) ||
      (prevInputLengthRef.current >= MONACO_SIZE_LIMIT && inputLength < MONACO_SIZE_LIMIT);

    const outputCrossedThreshold =
      (prevOutputLengthRef.current < MONACO_SIZE_LIMIT && outputLength >= MONACO_SIZE_LIMIT) ||
      (prevOutputLengthRef.current >= MONACO_SIZE_LIMIT && outputLength < MONACO_SIZE_LIMIT);

    if (inputCrossedThreshold || outputCrossedThreshold ||
      (inputLength > 0 && prevInputLengthRef.current === 0) ||
      (outputLength > 0 && prevOutputLengthRef.current === 0)) {
      updateEditorTypes(inputContent, outputContent);
    }

    prevInputLengthRef.current = inputLength;
    prevOutputLengthRef.current = outputLength;
  }, [state.textInput, state.textOutput, updateEditorTypes]);

  const detectFileType = (base64String: string, hintMimeType?: string | null): string | null => {
    if (!base64String) return null;

    // If we have a strong hint from the data URI, trust it for common types
    if (hintMimeType) {
      if (hintMimeType.includes('image/jpeg')) return 'jpeg';
      if (hintMimeType.includes('image/png')) return 'png';
      if (hintMimeType.includes('image/gif')) return 'gif';
      if (hintMimeType.includes('image/webp')) return 'webp';
      if (hintMimeType.includes('image/svg')) return 'svg';
      if (hintMimeType.includes('application/pdf')) return 'pdf';
      if (hintMimeType.includes('application/json')) return 'json';
      if (hintMimeType.includes('text/xml') || hintMimeType.includes('application/xml')) return 'xml';
      if (hintMimeType.includes('text/csv')) return 'csv';
      if (hintMimeType.includes('video/mp4')) return 'mp4';
      if (hintMimeType.includes('audio/mpeg')) return 'mp3';
    }

    const cleanBase64 = base64String.replace(/^data:[^;]+;base64,/, '').trim();
    if (cleanBase64.length < 4) return null;

    try {
      const sampleLength = Math.min(cleanBase64.length, 100);
      const binaryString = atob(cleanBase64.substring(0, sampleLength));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Check file signatures (magic bytes)
      // Images
      if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'jpeg';
      if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'png';
      if (bytes.length >= 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'gif';
      // ... remainder of detection logic ...
      if (bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
        // RIFF container
        if (bytes.length >= 12) {
          const format = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
          if (format === 'WEBP') return 'webp';
          if (format === 'WAVE') return 'wav';
          if (format === 'AVI ') return 'avi';
        }
        return 'webp';
      }
      if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4D) return 'bmp';
      if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) return 'ico';

      // Documents
      if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf';

      // ZIP
      if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) return 'zip';
      if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4B) return 'zip';

      // Audio/Video
      if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return 'mp3';
      if (bytes.length >= 2 && bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) return 'mp3';
      if (bytes.length >= 4 && bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return 'ogg';
      if (bytes.length >= 4 && bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) return 'flac';

      if (bytes.length >= 8) {
        const ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
        if (['ftyp', 'M4V ', 'MSNV', 'isom', 'mp42'].includes(ftyp) || ftyp.trim() === 'ftyp') return 'mp4';
      }
      if (bytes.length >= 4 && bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) return 'webm';

      // Try text/json/xml detection if no binary signature
      try {
        const fullDecoded = decodeURIComponent(escape(atob(cleanBase64)));
        const trimmed = fullDecoded.trim();

        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            JSON.parse(trimmed);
            return 'json';
          } catch { }
        }

        if (trimmed.startsWith('<?xml') || trimmed.startsWith('<')) {
          if (trimmed.includes('<html') || trimmed.includes('<!DOCTYPE html')) return 'html';
          if (trimmed.includes('<svg')) return 'svg';
          return 'xml';
        }

        if (trimmed.includes(',') && trimmed.includes('\n')) {
          // Simple CSV check
          const lines = trimmed.split('\n').slice(0, 5);
          if (lines.length >= 2 && lines[0].includes(',')) return 'csv';
        }

        // General text
        const printableRatio = fullDecoded.split('').filter(char => {
          const code = char.charCodeAt(0);
          return (code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13;
        }).length / fullDecoded.length;

        if (printableRatio > 0.85) return 'text';
      } catch {
        // failed text decode
      }

      return 'binary';
    } catch {
      return null;
    }
  };

  const prettifyContent = (content: string, type: 'json' | 'xml'): string => {
    try {
      if (type === 'json') {
        const parsed = JSON.parse(content);
        return JSON.stringify(parsed, null, 2);
      } else if (type === 'xml') {
        return content
          .replace(/></g, '>\n<')
          .replace(/^\s*\n/gm, '')
          .split('\n')
          .map((line, index, array) => {
            const trimmed = line.trim();
            if (!trimmed) return '';

            const isClosingTag = trimmed.startsWith('</');
            const depth = array.slice(0, index).reduce((acc, prevLine) => {
              const prev = prevLine.trim();
              if (prev.startsWith('</')) return acc - 1;
              if (prev.includes('<') && !prev.endsWith('/>')) return acc + 1;
              return acc;
            }, 0);

            const indent = '  '.repeat(Math.max(0, isClosingTag ? depth - 1 : depth));
            return indent + trimmed;
          })
          .join('\n');
      }
    } catch {
      return content;
    }
    return content;
  };

  const processText = useCallback((input: string, mode: 'encode' | 'decode') => {
    if (!input || !input.trim()) {
      setState({ textOutput: '', error: null, fileType: null });
      return;
    }

    try {
      let result: string;
      let detectedFileType: string | null = null;

      if (mode === 'encode') {
        const base64String = btoa(unescape(encodeURIComponent(input)));
        // Add line breaks every 76 characters for better readability (standard practice)
        result = base64String.replace(/.{76}/g, '$&\n');
      } else {
        let cleanInput = input.trim();
        let mimeFromHeader: string | null = null;

        if (cleanInput.startsWith('data:')) {
          const commaIndex = cleanInput.indexOf(',');
          if (commaIndex !== -1) {
            const header = cleanInput.substring(0, commaIndex);
            const match = header.match(/^data:([^;]+);/);
            if (match) {
              mimeFromHeader = match[1];
            }
            cleanInput = cleanInput.substring(commaIndex + 1);
          }
        }

        cleanInput = cleanInput.replace(/\s+/g, ''); // Remove all whitespace including line breaks

        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!base64Regex.test(cleanInput)) {
          throw new Error('Invalid Base64 format');
        }

        detectedFileType = detectFileType(cleanInput, mimeFromHeader);

        // Handle different file types appropriately
        const binaryTypes = ['jpeg', 'png', 'gif', 'webp', 'bmp', 'ico', 'pdf', 'zip', 'mp3', 'mp4', 'wav', 'ogg', 'flac', 'webm', 'avi', 'binary'];
        if (detectedFileType && binaryTypes.includes(detectedFileType)) {
          // For binary files, show a preview message instead of corrupted text
          const base64Length = cleanInput.length;
          const fileSizeBytes = (base64Length * 3) / 4;
          const fileSizeKB = fileSizeBytes / 1024;
          const fileSizeMB = fileSizeBytes / (1024 * 1024);
          const sizeDisplay = fileSizeMB >= 1 ? `${fileSizeMB.toFixed(1)} MB` : `${fileSizeKB.toFixed(1)} KB`;

          // Get friendly type name
          const typeNames: Record<string, string> = {
            jpeg: 'JPEG Image', png: 'PNG Image', gif: 'GIF Image', webp: 'WebP Image',
            bmp: 'Bitmap Image', ico: 'Icon File', pdf: 'PDF Document', zip: 'ZIP Archive',
            mp3: 'MP3 Audio', mp4: 'MP4 Video', wav: 'WAV Audio', ogg: 'OGG Audio',
            flac: 'FLAC Audio', webm: 'WebM Video', avi: 'AVI Video', binary: 'Binary File'
          };
          const typeName = typeNames[detectedFileType] || detectedFileType.toUpperCase();

          // Check if file is too large for safe processing
          if (fileSizeBytes > SAFE_PROCESSING_SIZE_LIMIT) {
            result = `⚠️ Large ${typeName} detected (${sizeDisplay})\n\nThis file is too large for safe processing. Files over ${SAFE_PROCESSING_SIZE_LIMIT / (1024 * 1024)}MB may cause issues.\n\nConsider using a dedicated application for this file type.`;
          } else {
            result = `✅ ${typeName} detected (${sizeDisplay})\n\nFile preview is available below. You can save the file or use "Show Raw" to see the binary content.\n\nBase64 length: ${base64Length.toLocaleString()} characters`;
          }
        } else {
          // For text files, decode normally
          try {
            result = decodeURIComponent(escape(atob(cleanInput)));
          } catch {
            result = atob(cleanInput);
          }

          if (detectedFileType === 'json' || detectedFileType === 'xml') {
            try {
              result = prettifyContent(result, detectedFileType as 'json' | 'xml');
            } catch {
              // Keep original if prettification fails
            }
          }
        }
      }

      setState({ textOutput: result, error: null, fileType: detectedFileType });
    } catch (error) {
      setState({
        textOutput: '',
        error: mode === 'decode' ? 'Invalid Base64 input - please ensure it\'s properly formatted' : 'Encoding failed',
        fileType: null
      });
    }
  }, [setState]);

  // Track paste operations for optimized processing
  const isPasteOperation = useRef(false);

  // Handle actual paste events for immediate processing (only for textarea fallback)
  const handlePaste = useCallback((event: ClipboardEvent) => {
    // Mark this as a paste operation for optimized handling
    isPasteOperation.current = true;

    // Clear any existing timeout to prevent duplicate processing
    if (pasteProcessingTimeoutRef.current) {
      clearTimeout(pasteProcessingTimeoutRef.current);
      pasteProcessingTimeoutRef.current = null;
    }

    // Reset the flag after a short delay if onChange doesn't fire (edge case)
    setTimeout(() => {
      isPasteOperation.current = false;
    }, 100);
  }, []);

  const handleTextInputChange = useCallback((value: string | undefined) => {
    const newValue = value || '';
    setState({ textInput: newValue });

    // Clear any existing paste processing timeout
    if (pasteProcessingTimeoutRef.current) {
      clearTimeout(pasteProcessingTimeoutRef.current);
    }

    // Check if this is a paste operation
    if (isPasteOperation.current) {
      // Reset the flag and process immediately for paste operations
      isPasteOperation.current = false;
      processText(newValue, state.mode);
      return;
    }

    // Check if this might be a large content change (drag&drop or programmatic)
    const previousLength = (state.textInput || '').length;
    const currentLength = newValue.length;
    const isLargeChange = Math.abs(currentLength - previousLength) > 1000;

    if (isLargeChange) {
      // For large changes (like drag&drop), use a small delay
      pasteProcessingTimeoutRef.current = setTimeout(() => {
        processText(newValue, state.mode);
      }, 100); // Shorter delay for better UX
    } else {
      // For regular typing, process immediately
      processText(newValue, state.mode);
    }
  }, [processText, setState, state.mode, state.textInput]);

  const handleModeChange = useCallback((mode: 'encode' | 'decode') => {
    setState({ mode, textOutput: '', error: null, fileType: null });
    if (state.textInput && state.textInput.trim()) {
      processText(state.textInput, mode);
    }
  }, [processText, setState, state.textInput]);

  // File upload functionality
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setState({ isProcessing: true, progress: 0, error: null, mode: 'encode' });

    try {
      const isTextFile = file.type.startsWith('text/') ||
        file.type === 'application/json' ||
        file.type === 'application/xml' ||
        file.type === 'application/javascript' ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.json') ||
        file.name.endsWith('.xml');

      if (isTextFile) {
        // Handle text files
        const text = await file.text();
        setState({
          textInput: text,
          fileName: file.name,
          isProcessing: false,
          progress: 0
        });
        processText(text, 'encode');
      } else {
        // Handle binary files
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < uint8Array.byteLength; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binary);

        setState({
          textInput: base64,
          fileName: file.name,
          isProcessing: false,
          progress: 0
        });
        processText(base64, 'encode');
      }
    } catch (error) {
      setState({
        error: `Failed to process file: ${error}`,
        isProcessing: false,
        progress: 0
      });
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setState({ copySuccess: true });
      setTimeout(() => setState({ copySuccess: false }), 2000);
    });
  };

  const clearAll = () => {
    // Clean up blob URLs
    blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    blobUrlsRef.current = [];

    setState({
      textInput: '',
      textOutput: '',
      error: null,
      fileType: null,
      fileName: null,
      isProcessing: false,
      progress: 0,
      progressMessage: '',
      copySuccess: false,
      useMonacoForInput: true,
      useMonacoForOutput: true,
      showFilePreview: true,
      showRawView: false
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const swapInputOutput = () => {
    if (state.textOutput && !state.error) {
      const newMode = state.mode === 'encode' ? 'decode' : 'encode';
      setState({
        textInput: state.textOutput,
        textOutput: '',
        mode: newMode,
        error: null,
        fileType: null
      });
      processText(state.textOutput, newMode);
    }
  };

  const getLanguageFromFileType = () => {
    if (state.fileType === 'json') return 'json';
    if (state.fileType === 'xml') return 'xml';
    if (state.mode === 'encode') {
      const content = (state.textInput || '').trim();
      if (content.startsWith('{') || content.startsWith('[')) return 'json';
      if (content.startsWith('<')) return 'xml';
    }
    return 'plaintext';
  };

  // Safely calculate file size from base64 without processing
  const getFileSizeFromBase64 = (base64String: string): number => {
    try {
      let cleanInput = base64String.trim();

      if (cleanInput.startsWith('data:')) {
        const commaIndex = cleanInput.indexOf(',');
        if (commaIndex !== -1) {
          cleanInput = cleanInput.substring(commaIndex + 1);
        }
      }

      cleanInput = cleanInput.replace(/\s/g, '');
      const base64Length = cleanInput.length;
      return (base64Length * 3) / 4; // Convert base64 length to file size
    } catch {
      return 0;
    }
  };

  // Check if file is safe to process
  const isFileSafeToProcess = (base64String: string): boolean => {
    const fileSize = getFileSizeFromBase64(base64String);
    return fileSize <= SAFE_PROCESSING_SIZE_LIMIT;
  };

  // Create efficient Blob URL for large files instead of data URLs
  const createBlobUrl = (base64String: string, mimeType: string): string => {
    try {
      let cleanInput = base64String.trim();

      if (cleanInput.startsWith('data:')) {
        const commaIndex = cleanInput.indexOf(',');
        if (commaIndex !== -1) {
          cleanInput = cleanInput.substring(commaIndex + 1);
        }
      }

      cleanInput = cleanInput.replace(/\s/g, '');

      // Convert base64 to binary
      const binaryString = atob(cleanInput);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create blob and return URL
      const blob = new Blob([bytes], { type: mimeType });
      const url = URL.createObjectURL(blob);

      // Track URL for cleanup
      blobUrlsRef.current.push(url);

      return url;
    } catch (error) {
      console.error('Failed to create blob URL:', error);
      return '';
    }
  };

  // Get raw decoded content for binary files
  const getRawDecodedContent = () => {
    if (!state.textInput || state.mode === 'encode') return '';

    // Check if file is too large to safely decode
    if (!isFileSafeToProcess(state.textInput)) {
      const fileSizeMB = (getFileSizeFromBase64(state.textInput) / (1024 * 1024)).toFixed(1);
      return `File too large to display raw content (${fileSizeMB} MB)\n\nFor safety reasons, files larger than ${SAFE_PROCESSING_SIZE_LIMIT / (1024 * 1024)}MB are not decoded for raw viewing to prevent browser crashes.`;
    }

    try {
      let cleanInput = state.textInput.trim();

      if (cleanInput.startsWith('data:')) {
        const commaIndex = cleanInput.indexOf(',');
        if (commaIndex !== -1) {
          cleanInput = cleanInput.substring(commaIndex + 1);
        }
      }

      cleanInput = cleanInput.replace(/\s/g, '');

      // For binary files, return the raw decoded content
      const binaryTypes = ['jpeg', 'png', 'gif', 'webp', 'bmp', 'ico', 'pdf', 'zip', 'mp3', 'mp4', 'wav', 'ogg', 'flac', 'webm', 'avi', 'binary'];
      if (state.fileType && binaryTypes.includes(state.fileType)) {
        try {
          return atob(cleanInput);
        } catch {
          return 'Unable to decode binary content';
        }
      } else {
        // For text files, use the normal decoded content
        return state.textOutput || '';
      }
    } catch {
      return 'Unable to decode content';
    }
  };

  // Ultra-stable Monaco editor keys - prevent recreation on language changes
  const inputEditorKey = useMemo(() => {
    // Only change key when absolutely necessary (mode or editor type changes)
    return `input-${state.mode}-${state.useMonacoForInput ? 'monaco' : 'textarea'}`;
  }, [state.mode, state.useMonacoForInput]);

  const outputEditorKey = useMemo(() => {
    // Only change key when absolutely necessary (mode or editor type changes)
    return `output-${state.mode}-${state.useMonacoForOutput ? 'monaco' : 'textarea'}`;
  }, [state.mode, state.useMonacoForOutput]);

  // File preview component
  const renderFilePreview = () => {
    if (!state.fileType || state.mode === 'encode' || !state.textInput) return null;

    const fileSizeBytes = getFileSizeFromBase64(state.textInput);
    const fileSizeMB = fileSizeBytes / (1024 * 1024);

    if (!state.showFilePreview) return null;

    // For very large files, don't create data URLs at all to prevent crashes
    if (fileSizeBytes > SAFE_PROCESSING_SIZE_LIMIT) {
      return (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <h4 className="text-sm font-medium text-red-700 dark:text-red-300 mb-2 flex items-center">
            <ExclamationTriangleIcon className="w-4 h-4 mr-2" />
            File Too Large for Preview ({fileSizeMB.toFixed(1)} MB)
          </h4>
          <div className="text-sm text-red-600 dark:text-red-400 space-y-2">
            <p>This {state.fileType.toUpperCase()} file is too large to preview safely in the browser.</p>
            <p>Files over {SAFE_PROCESSING_SIZE_LIMIT / (1024 * 1024)}MB may cause browser crashes or freezing.</p>
            <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/40 rounded border">
              <p className="font-medium text-red-800 dark:text-red-300 mb-1">Recommendations:</p>
              <ul className="text-sm text-red-700 dark:text-red-400 space-y-1">
                <li>• Use a dedicated {state.fileType.toUpperCase()} viewer application</li>
                <li>• Split the file into smaller chunks</li>
                <li>• Process on a server with more memory</li>
                <li>• Use command-line tools for large file processing</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    // Use Blob URLs for better performance with large files
    const mimeTypes: Record<string, string> = {
      // Images
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'ico': 'image/x-icon',
      'svg': 'image/svg+xml',
      // Documents
      'pdf': 'application/pdf',
      'zip': 'application/zip',
      'json': 'application/json',
      'xml': 'application/xml',
      'html': 'text/html',
      'csv': 'text/csv',
      'text': 'text/plain',
      // Audio
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'flac': 'audio/flac',
      // Video
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'avi': 'video/x-msvideo',
    };
    const mimeType = mimeTypes[state.fileType] || 'application/octet-stream';

    // Get file extension for save
    const fileExtensions: Record<string, string> = {
      jpeg: 'jpg', png: 'png', gif: 'gif', webp: 'webp', bmp: 'bmp', ico: 'ico', svg: 'svg',
      pdf: 'pdf', zip: 'zip', json: 'json', xml: 'xml', html: 'html', csv: 'csv', text: 'txt',
      mp3: 'mp3', wav: 'wav', ogg: 'ogg', flac: 'flac',
      mp4: 'mp4', webm: 'webm', avi: 'avi', binary: 'bin'
    };
    const extension = fileExtensions[state.fileType] || 'bin';

    // Friendly type names
    const typeNames: Record<string, string> = {
      jpeg: 'JPEG Image', png: 'PNG Image', gif: 'GIF Image', webp: 'WebP Image',
      bmp: 'Bitmap Image', ico: 'Icon File', svg: 'SVG Image',
      pdf: 'PDF Document', zip: 'ZIP Archive', json: 'JSON File', xml: 'XML File',
      html: 'HTML File', csv: 'CSV File', text: 'Text File',
      mp3: 'MP3 Audio', wav: 'WAV Audio', ogg: 'OGG Audio', flac: 'FLAC Audio',
      mp4: 'MP4 Video', webm: 'WebM Video', avi: 'AVI Video', binary: 'Binary File'
    };
    const typeName = typeNames[state.fileType] || state.fileType.toUpperCase();

    // For large files, use Blob URLs; for small files, use data URLs for simplicity
    const fileUrl = fileSizeBytes > 1024 * 1024 // > 1MB
      ? createBlobUrl(state.textInput, mimeType)
      : (state.textInput || '').includes('data:')
        ? state.textInput
        : `data:${mimeType};base64,${(state.textInput || '').replace(/\s/g, '')}`;

    // Common Save button component
    const SaveButton = ({ className = '' }: { className?: string }) => (
      <a
        href={fileUrl}
        download={`decoded-file.${extension}`}
        className={`inline-flex items-center px-4 py-2 text-sm font-medium bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-sm hover:shadow-md ${className}`}
      >
        <DocumentArrowUpIcon className="w-4 h-4 mr-2" />
        Save {typeName}
      </a>
    );

    // Size display helper
    const sizeDisplay = fileSizeMB >= 1 ? `${fileSizeMB.toFixed(1)} MB` : `${(fileSizeBytes / 1024).toFixed(1)} KB`;

    // Image types
    if (['jpeg', 'png', 'gif', 'webp', 'bmp', 'ico', 'svg'].includes(state.fileType)) {
      return (
        <div className="mt-4 p-5 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl border border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center">
              <PhotoIcon className="w-5 h-5 mr-2 text-blue-500" />
              {typeName} Preview
              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full">
                {sizeDisplay}
              </span>
            </h4>
            <SaveButton />
          </div>
          {fileSizeBytes > FILE_PREVIEW_SIZE_LIMIT ? (
            <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Image is {sizeDisplay} - too large for preview. Use the Save button above.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
              <img
                src={fileUrl}
                alt="Preview"
                className="max-w-full max-h-96 object-contain rounded mx-auto"
                onError={() => setState({ fileType: null })}
              />
            </div>
          )}
        </div>
      );
    }

    // Audio types
    if (['mp3', 'wav', 'ogg', 'flac'].includes(state.fileType)) {
      return (
        <div className="mt-4 p-5 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center">
              <SparklesIcon className="w-5 h-5 mr-2 text-purple-500" />
              {typeName} Preview
              <span className="ml-2 px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full">
                {sizeDisplay}
              </span>
            </h4>
            <SaveButton />
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
            <audio
              controls
              className="w-full"
              src={fileUrl}
            >
              Your browser does not support audio playback.
            </audio>
          </div>
        </div>
      );
    }

    // Video types
    if (['mp4', 'webm', 'avi'].includes(state.fileType)) {
      return (
        <div className="mt-4 p-5 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-xl border border-indigo-200 dark:border-indigo-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center">
              <SparklesIcon className="w-5 h-5 mr-2 text-indigo-500" />
              {typeName} Preview
              <span className="ml-2 px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full">
                {sizeDisplay}
              </span>
            </h4>
            <SaveButton />
          </div>
          {fileSizeBytes > FILE_PREVIEW_SIZE_LIMIT ? (
            <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Video is {sizeDisplay} - too large for preview. Use the Save button above.
              </p>
            </div>
          ) : (
            <div className="bg-black rounded-lg overflow-hidden">
              <video
                controls
                className="w-full max-h-96"
                src={fileUrl}
              >
                Your browser does not support video playback.
              </video>
            </div>
          )}
        </div>
      );
    }

    // PDF
    if (state.fileType === 'pdf') {
      return (
        <div className="mt-4 p-5 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-xl border border-red-200 dark:border-red-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center">
              <DocumentIcon className="w-5 h-5 mr-2 text-red-500" />
              PDF Document
              <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-full">
                {sizeDisplay}
              </span>
            </h4>
            <SaveButton />
          </div>
          {fileSizeBytes > FILE_PREVIEW_SIZE_LIMIT ? (
            <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                PDF is {sizeDisplay} - too large for preview. Use the Save button above.
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden bg-white" style={{ height: '450px' }}>
              <iframe
                src={fileUrl}
                className="w-full h-full"
                title="PDF Preview"
                style={{ border: 'none' }}
              />
            </div>
          )}
        </div>
      );
    }

    // Default - other binary files (zip, etc.)
    return (
      <div className="mt-4 p-5 bg-gradient-to-br from-gray-50 to-slate-100 dark:from-gray-700 dark:to-slate-800 rounded-xl border border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center">
            <DocumentIcon className="w-5 h-5 mr-2 text-gray-500" />
            {typeName}
            <span className="ml-2 px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full">
              {sizeDisplay}
            </span>
          </h4>
          <SaveButton />
        </div>
        <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            {state.fileType === 'zip'
              ? 'ZIP archive detected. Save the file to extract its contents.'
              : `${typeName} detected. Save the file to open it with an appropriate application.`
            }
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full w-full bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 overflow-auto">
      <div className="container mx-auto px-6 py-8 max-w-6xl min-h-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Base64 Encoder/Decoder
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Encode and decode text or files to/from Base64 format with live preview
          </p>
        </div>

        {/* Error Display */}
        {state.error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="text-red-800 dark:text-red-400 font-medium">Error</h4>
              <p className="text-red-700 dark:text-red-300 text-sm mt-1">{state.error}</p>
            </div>
          </div>
        )}

        {/* Processing Progress */}
        {state.isProcessing && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-800 dark:text-blue-400 font-medium">Processing...</span>
              <span className="text-blue-600 dark:text-blue-400 text-sm">{state.progress || 0}%</span>
            </div>
            <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${state.progress || 0}%` }}
              />
            </div>
            {state.progressMessage && (
              <p className="text-blue-700 dark:text-blue-300 text-sm mt-2">{state.progressMessage}</p>
            )}
          </div>
        )}

        <div className="space-y-6">
          {/* Mode Selection */}
          <div className="flex justify-center">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-700 flex">
              <button
                onClick={() => handleModeChange('encode')}
                className={`px-6 py-3 rounded-md font-medium transition-all ${state.mode === 'encode'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
              >
                <CodeBracketIcon className="w-5 h-5 inline mr-2" />
                Encode
              </button>
              <button
                onClick={() => handleModeChange('decode')}
                className={`px-6 py-3 rounded-md font-medium transition-all ${state.mode === 'decode'
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400'
                  }`}
              >
                <DocumentTextIcon className="w-5 h-5 inline mr-2" />
                Decode
              </button>
            </div>
          </div>

          {/* Input Section with File Upload */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                    <DocumentTextIcon className="w-5 h-5 mr-2" />
                    Input ({state.mode === 'encode' ? 'Plain Text' : 'Base64'})
                    {state.fileName && (
                      <span className="ml-2 px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                        {state.fileName}
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {state.mode === 'encode'
                      ? 'Enter text to encode, upload files, or drag & drop'
                      : 'Paste Base64 string to decode - files will show preview automatically'
                    }
                  </p>
                </div>
                {state.mode === 'encode' && (
                  <div className="flex space-x-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileInputChange}
                      className="hidden"
                      aria-label="Select file to encode"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-md hover:bg-green-200 dark:hover:bg-green-800 transition-colors flex items-center"
                    >
                      <DocumentArrowUpIcon className="w-4 h-4 mr-1" />
                      Upload File
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div
              className={`p-6 ${dragActive ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-300 dark:border-blue-600' : ''}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {dragActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-blue-50/90 dark:bg-blue-900/90 rounded-lg z-10">
                  <div className="text-center">
                    <DocumentArrowUpIcon className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                    <p className="text-blue-700 dark:text-blue-300 font-medium">Drop file to upload</p>
                  </div>
                </div>
              )}
              <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden relative">
                {state.useMonacoForInput ? (
                  <CodeEditor
                    key={inputEditorKey}
                    value={state.textInput || ''}
                    onChange={handleTextInputChange}
                    language={state.mode === 'encode' ? getLanguageFromFileType() : 'plaintext'}
                    theme={theme === 'dark' ? 'vs-dark' : 'light'}
                    height="300px"
                  />
                ) : (
                  <textarea
                    value={state.textInput || ''}
                    onChange={e => handleTextInputChange(e.target.value)}
                    onPaste={(e) => handlePaste(e.nativeEvent)}
                    className="w-full h-80 p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-mono text-sm resize-none border-none outline-none"
                    placeholder={`Enter ${state.mode === 'encode' ? 'text to encode' : 'base64 to decode'}...`}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Output Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <CodeBracketIcon className="w-5 h-5 mr-2" />
                Output ({state.mode === 'encode' ? 'Base64' : 'Plain Text'})
                {state.fileType && (
                  <span className="ml-2 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                    {state.fileType.toUpperCase()}
                  </span>
                )}
              </h3>
              <div className="flex space-x-2">
                {state.fileType && state.mode === 'decode' && (
                  <>
                    <button
                      onClick={() => setState({ showFilePreview: !state.showFilePreview })}
                      className="px-3 py-1.5 text-sm bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-md hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors flex items-center"
                    >
                      {state.showFilePreview ? (
                        <>
                          <EyeSlashIcon className="w-4 h-4 mr-1" />
                          Hide Preview
                        </>
                      ) : (
                        <>
                          <EyeIcon className="w-4 h-4 mr-1" />
                          Show Preview
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setState({ showRawView: !state.showRawView })}
                      className="px-3 py-1.5 text-sm bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded-md hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors flex items-center"
                    >
                      {state.showRawView ? 'Hide Raw' : 'Show Raw'}
                    </button>
                  </>
                )}
                {state.textOutput && (
                  <>
                    <button
                      onClick={() => copyToClipboard(state.textOutput)}
                      className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center"
                    >
                      {state.copySuccess ? (
                        <>
                          <CheckIcon className="w-4 h-4 mr-1" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <ClipboardDocumentIcon className="w-4 h-4 mr-1" />
                          Copy
                        </>
                      )}
                    </button>
                    <button
                      onClick={swapInputOutput}
                      className="px-3 py-1.5 text-sm bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors flex items-center"
                    >
                      <ArrowsRightLeftIcon className="w-4 h-4 mr-1" />
                      Swap
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="p-6">
              {state.showRawView && state.fileType ? (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Raw Decoded Content:
                    {state.fileType && ['jpeg', 'png', 'gif', 'webp', 'bmp', 'pdf', 'zip', 'binary'].includes(state.fileType) && (
                      <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded">
                        Binary Data
                      </span>
                    )}
                  </h4>
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                    <textarea
                      value={getRawDecodedContent()}
                      readOnly
                      className="w-full h-40 p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-mono text-xs resize-none border-none outline-none"
                      placeholder="Raw decoded content..."
                    />
                  </div>
                  {state.fileType && ['jpeg', 'png', 'gif', 'webp', 'bmp', 'pdf', 'zip', 'binary'].includes(state.fileType) && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      ⚠️ This shows raw binary data which may appear as unreadable characters. Use the file preview above for proper viewing.
                    </p>
                  )}
                </div>
              ) : (
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                  {state.useMonacoForOutput ? (
                    <CodeEditor
                      key={outputEditorKey}
                      value={state.textOutput || ''}
                      language={state.mode === 'decode' ? getLanguageFromFileType() : 'plaintext'}
                      theme={theme === 'dark' ? 'vs-dark' : 'light'}
                      readOnly
                      height="300px"
                    />
                  ) : (
                    <textarea
                      value={state.textOutput || ''}
                      readOnly
                      className="w-full h-80 p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-mono text-sm resize-none border-none outline-none"
                      placeholder="Output will appear here..."
                    />
                  )}
                </div>
              )}

              {/* File Preview */}
              {renderFilePreview()}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center">
            <button
              onClick={clearAll}
              className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Base64; 