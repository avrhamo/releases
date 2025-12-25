import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardDocumentIcon,
  CheckIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  KeyIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { BaseToolProps, ToolState } from '../types';
import CryptoJS from 'crypto-js';

// Hash tool state interface
interface HashToolState extends ToolState<{
  inputText: string;
  selectedAlgorithm: string;
  outputHash: string;
  secretKey: string;
  showSecretKey: boolean;
  copySuccess: boolean;
  fileHash: string;
  fileName: string;
  hashHistory: Array<{
    id: string;
    algorithm: string;
    input: string;
    output: string;
    timestamp: number;
    hasSecret: boolean;
  }>;
  compareMode: boolean;
  compareHash: string;
  compareResult: 'match' | 'no-match' | null;
}> {}

// Available hash algorithms
const HASH_ALGORITHMS = {
  // Basic hashing
  'md5': { name: 'MD5', needsSecret: false, description: 'Fast but not cryptographically secure' },
  'sha1': { name: 'SHA-1', needsSecret: false, description: 'Legacy, not recommended for security' },
  'sha256': { name: 'SHA-256', needsSecret: false, description: 'Secure, widely used' },
  'sha384': { name: 'SHA-384', needsSecret: false, description: 'More secure variant of SHA-2' },
  'sha512': { name: 'SHA-512', needsSecret: false, description: 'Most secure SHA-2 variant' },
  'sha3': { name: 'SHA-3', needsSecret: false, description: 'Latest secure standard' },
  'ripemd160': { name: 'RIPEMD-160', needsSecret: false, description: 'Alternative to SHA-1' },
  
  // HMAC variants (need secret key)
  'hmac-md5': { name: 'HMAC-MD5', needsSecret: true, description: 'MD5 with secret key' },
  'hmac-sha1': { name: 'HMAC-SHA1', needsSecret: true, description: 'SHA-1 with secret key' },
  'hmac-sha256': { name: 'HMAC-SHA256', needsSecret: true, description: 'SHA-256 with secret key (recommended)' },
  'hmac-sha384': { name: 'HMAC-SHA384', needsSecret: true, description: 'SHA-384 with secret key' },
  'hmac-sha512': { name: 'HMAC-SHA512', needsSecret: true, description: 'SHA-512 with secret key' },
};

// Common use cases for developers
const USE_CASES = [
  { 
    name: 'API Signature', 
    algorithm: 'hmac-sha256', 
    description: 'Generate HMAC signatures for API requests',
    example: 'timestamp=1234567890&user=john'
  },
  { 
    name: 'Password Hashing', 
    algorithm: 'sha256', 
    description: 'Hash passwords (use bcrypt in production)',
    example: 'mySecurePassword123'
  },
  { 
    name: 'Data Integrity', 
    algorithm: 'sha256', 
    description: 'Verify file or data integrity',
    example: 'File content or data to verify'
  },
  { 
    name: 'JWT Secret', 
    algorithm: 'hmac-sha256', 
    description: 'Generate JWT signatures',
    example: 'header.payload'
  }
];

const Hash: React.FC<BaseToolProps> = ({ state, setState }) => {
  const hashState = state as HashToolState;
  
  const [processingFile, setProcessingFile] = useState(false);

  // Hash computation function
  const computeHash = useCallback((text: string, algorithm: string, secret?: string): string => {
    if (!text) return '';
    
    try {
      switch (algorithm) {
        case 'md5':
          return CryptoJS.MD5(text).toString();
        case 'sha1':
          return CryptoJS.SHA1(text).toString();
        case 'sha256':
          return CryptoJS.SHA256(text).toString();
        case 'sha384':
          return CryptoJS.SHA384(text).toString();
        case 'sha512':
          return CryptoJS.SHA512(text).toString();
        case 'sha3':
          return CryptoJS.SHA3(text).toString();
        case 'ripemd160':
          return CryptoJS.RIPEMD160(text).toString();
        case 'hmac-md5':
          return secret ? CryptoJS.HmacMD5(text, secret).toString() : '';
        case 'hmac-sha1':
          return secret ? CryptoJS.HmacSHA1(text, secret).toString() : '';
        case 'hmac-sha256':
          return secret ? CryptoJS.HmacSHA256(text, secret).toString() : '';
        case 'hmac-sha384':
          return secret ? CryptoJS.HmacSHA384(text, secret).toString() : '';
        case 'hmac-sha512':
          return secret ? CryptoJS.HmacSHA512(text, secret).toString() : '';
        default:
          return '';
      }
    } catch (error) {
      console.error('Hashing error:', error);
      return 'Error computing hash';
    }
  }, []);

  // Update hash when input changes
  useEffect(() => {
    const algorithm = hashState.selectedAlgorithm || 'sha256';
    const needsSecret = HASH_ALGORITHMS[algorithm as keyof typeof HASH_ALGORITHMS]?.needsSecret;
    
    let newHash = '';
    if (hashState.inputText) {
      if (needsSecret && hashState.secretKey) {
        newHash = computeHash(hashState.inputText, algorithm, hashState.secretKey);
      } else if (!needsSecret) {
        newHash = computeHash(hashState.inputText, algorithm);
      }
    }
    
    setState({
      outputHash: newHash,
      compareResult: hashState.compareMode && hashState.compareHash && newHash 
        ? (newHash.toLowerCase() === hashState.compareHash.toLowerCase() ? 'match' : 'no-match')
        : null
    });
  }, [hashState.inputText, hashState.selectedAlgorithm, hashState.secretKey, hashState.compareHash, hashState.compareMode, computeHash]);

  // Copy to clipboard
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setState({ copySuccess: true });
      setTimeout(() => setState({ copySuccess: false }), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  // Add to history
  const addToHistory = useCallback(() => {
    if (!hashState.outputHash || !hashState.inputText) return;
    
    const historyItem = {
      id: Date.now().toString(),
      algorithm: hashState.selectedAlgorithm || 'sha256',
      input: hashState.inputText.substring(0, 100) + (hashState.inputText.length > 100 ? '...' : ''),
      output: hashState.outputHash,
      timestamp: Date.now(),
      hasSecret: HASH_ALGORITHMS[hashState.selectedAlgorithm as keyof typeof HASH_ALGORITHMS]?.needsSecret || false
    };
    
    const newHistory = [historyItem, ...(hashState.hashHistory || [])].slice(0, 10);
    setState({ hashHistory: newHistory });
  }, [hashState.outputHash, hashState.inputText, hashState.selectedAlgorithm, hashState.hashHistory]);

  // Clear all
  const clearAll = useCallback(() => {
    setState({
      inputText: '',
      outputHash: '',
      secretKey: '',
      fileHash: '',
      fileName: '',
      compareHash: '',
      compareResult: null
    });
  }, []);

  // File upload handler
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setProcessingFile(true);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
      const algorithm = hashState.selectedAlgorithm || 'sha256';
      
      let fileHash = '';
      switch (algorithm) {
        case 'md5':
          fileHash = CryptoJS.MD5(wordArray).toString();
          break;
        case 'sha1':
          fileHash = CryptoJS.SHA1(wordArray).toString();
          break;
        case 'sha256':
          fileHash = CryptoJS.SHA256(wordArray).toString();
          break;
        case 'sha384':
          fileHash = CryptoJS.SHA384(wordArray).toString();
          break;
        case 'sha512':
          fileHash = CryptoJS.SHA512(wordArray).toString();
          break;
        default:
          fileHash = CryptoJS.SHA256(wordArray).toString();
      }
      
      setState({
        fileHash,
        fileName: file.name
      });
    } catch (error) {
      console.error('File processing error:', error);
      setState({
        fileHash: 'Error processing file',
        fileName: file.name
      });
    } finally {
      setProcessingFile(false);
    }
  }, [hashState.selectedAlgorithm]);

  // Load use case example
  const loadUseCase = useCallback((useCase: typeof USE_CASES[0]) => {
    setState({
      inputText: useCase.example,
      selectedAlgorithm: useCase.algorithm,
      secretKey: useCase.algorithm.includes('hmac') ? 'your-secret-key' : ''
    });
  }, []);

  const selectedAlgo = HASH_ALGORITHMS[hashState.selectedAlgorithm as keyof typeof HASH_ALGORITHMS];
  const needsSecret = selectedAlgo?.needsSecret;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 min-h-screen">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center justify-center">
          <ShieldCheckIcon className="w-8 h-8 mr-3 text-blue-600" />
          Hash Generator
        </h1>
        <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Generate secure hashes and HMACs for API signatures, data integrity verification, and password hashing.
          Perfect for Spring Boot developers and DevOps teams.
        </p>
      </div>

      {/* Quick Use Cases */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center">
          <DocumentTextIcon className="w-5 h-5 mr-2" />
          Common Use Cases
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {USE_CASES.map((useCase, index) => (
            <button
              key={index}
              onClick={() => loadUseCase(useCase)}
              className="text-left p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
            >
              <div className="font-medium text-blue-800 dark:text-blue-200">{useCase.name}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{useCase.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Input and Settings */}
        <div className="space-y-6">
          {/* Algorithm Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
              <KeyIcon className="w-5 h-5 mr-2" />
              Hash Algorithm
            </h3>
            <select
              value={hashState.selectedAlgorithm || 'sha256'}
              onChange={(e) => setState({ selectedAlgorithm: e.target.value })}
              aria-label="Select hash algorithm"
              title="Choose hash algorithm"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <optgroup label="Standard Hashing">
                <option value="md5">MD5 - Fast (not secure)</option>
                <option value="sha1">SHA-1 - Legacy</option>
                <option value="sha256">SHA-256 - Recommended</option>
                <option value="sha384">SHA-384 - More secure</option>
                <option value="sha512">SHA-512 - Most secure</option>
                <option value="sha3">SHA-3 - Latest standard</option>
                <option value="ripemd160">RIPEMD-160</option>
              </optgroup>
              <optgroup label="HMAC (with secret key)">
                <option value="hmac-md5">HMAC-MD5</option>
                <option value="hmac-sha1">HMAC-SHA1</option>
                <option value="hmac-sha256">HMAC-SHA256 - API signatures</option>
                <option value="hmac-sha384">HMAC-SHA384</option>
                <option value="hmac-sha512">HMAC-SHA512</option>
              </optgroup>
            </select>
            {selectedAlgo && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {selectedAlgo.description}
              </p>
            )}
          </div>

          {/* Secret Key (for HMAC) */}
          {needsSecret && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                <KeyIcon className="w-5 h-5 mr-2" />
                Secret Key
              </h3>
              <div className="relative">
                <input
                  type={hashState.showSecretKey ? 'text' : 'password'}
                  value={hashState.secretKey || ''}
                  onChange={(e) => setState({ secretKey: e.target.value })}
                  placeholder="Enter your secret key for HMAC..."
                  className="w-full p-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={() => setState({ showSecretKey: !hashState.showSecretKey })}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {hashState.showSecretKey ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2 flex items-center">
                <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                Keep your secret key secure and never share it publicly
              </p>
            </div>
          )}

          {/* Text Input */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Input Text
            </h3>
            <textarea
              value={hashState.inputText || ''}
              onChange={(e) => setState({ inputText: e.target.value })}
              placeholder="Enter text to hash..."
              rows={6}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
            />
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Characters: {hashState.inputText?.length || 0}
            </div>
          </div>

          {/* File Upload */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              File Hashing
            </h3>
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={processingFile || needsSecret}
              aria-label="Upload file for hashing"
              title="Select file to hash"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
            {needsSecret && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                File hashing is not available for HMAC algorithms
              </p>
            )}
            {processingFile && (
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                Processing file...
              </p>
            )}
          </div>
        </div>

        {/* Right Column - Output and Tools */}
        <div className="space-y-6">
          {/* Hash Output */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Hash Output
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => copyToClipboard(hashState.outputHash || '')}
                  disabled={!hashState.outputHash}
                  title="Copy hash to clipboard"
                  aria-label="Copy hash to clipboard"
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {hashState.copySuccess ? <CheckIcon className="w-5 h-5" /> : <ClipboardDocumentIcon className="w-5 h-5" />}
                </button>
                <button
                  onClick={addToHistory}
                  disabled={!hashState.outputHash}
                  title="Add to history"
                  aria-label="Add hash to history"
                  className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ClockIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 min-h-[100px] font-mono text-sm break-all">
              {hashState.outputHash || (
                <span className="text-gray-400 dark:text-gray-500">
                  {needsSecret && !hashState.secretKey 
                    ? 'Enter a secret key to generate HMAC' 
                    : 'Hash will appear here...'}
                </span>
              )}
            </div>
          </div>

          {/* File Hash Output */}
          {hashState.fileHash && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                File Hash: {hashState.fileName}
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 font-mono text-sm break-all">
                {hashState.fileHash}
              </div>
              <button
                onClick={() => copyToClipboard(hashState.fileHash)}
                title="Copy file hash to clipboard"
                aria-label="Copy file hash to clipboard"
                className="mt-3 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ClipboardDocumentIcon className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Hash Comparison */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Hash Verification
              </h3>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={hashState.compareMode || false}
                  onChange={(e) => setState({ compareMode: e.target.checked, compareResult: null })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Enable compare mode</span>
              </label>
            </div>
            {hashState.compareMode && (
              <div className="space-y-4">
                <textarea
                  value={hashState.compareHash || ''}
                  onChange={(e) => setState({ compareHash: e.target.value })}
                  placeholder="Paste hash to compare..."
                  rows={3}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
                {hashState.compareResult && (
                  <div className={`p-3 rounded-lg flex items-center ${
                    hashState.compareResult === 'match' 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                  }`}>
                    {hashState.compareResult === 'match' ? (
                      <>
                        <CheckIcon className="w-5 h-5 mr-2" />
                        Hashes match! ✅
                      </>
                    ) : (
                      <>
                        <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
                        Hashes do not match ❌
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex space-x-3">
              <button
                onClick={clearAll}
                className="flex-1 p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center"
              >
                <TrashIcon className="w-5 h-5 mr-2" />
                Clear All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      {hashState.hashHistory && hashState.hashHistory.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
            <ClockIcon className="w-5 h-5 mr-2" />
            Recent Hashes
            <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto font-normal">
              {hashState.hashHistory.length} item{hashState.hashHistory.length !== 1 ? 's' : ''}
            </span>
          </h3>
          <div className="space-y-3 border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
            {hashState.hashHistory.map((item) => (
              <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-gray-800 dark:text-gray-200">
                    {HASH_ALGORITHMS[item.algorithm as keyof typeof HASH_ALGORITHMS]?.name}
                    {item.hasSecret && <KeyIcon className="w-4 h-4 inline ml-1" />}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Input: {item.input}
                </div>
                <div className="font-mono text-xs text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 p-2 rounded border break-all">
                  {item.output}
                </div>
                <button
                  onClick={() => copyToClipboard(item.output)}
                  className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                >
                  Copy hash
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Panel */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center">
          <InformationCircleIcon className="w-5 h-5 mr-2" />
          Developer Tips
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700 dark:text-blue-300">
          <div>
            <strong>API Signatures:</strong> Use HMAC-SHA256 with your API secret to sign requests.
          </div>
          <div>
            <strong>Spring Boot:</strong> Use @PreAuthorize with hash validation for security.
          </div>
          <div>
            <strong>Password Hashing:</strong> In production, use bcrypt or Argon2 instead of SHA.
          </div>
          <div>
            <strong>File Integrity:</strong> SHA-256 is perfect for verifying file checksums.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hash;
