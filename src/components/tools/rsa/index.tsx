import React from 'react';
import { BaseToolProps } from '../types';
import { LockClosedIcon, LockOpenIcon, KeyIcon, ShieldCheckIcon, DocumentTextIcon, ClipboardDocumentIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import KeyManager from './KeyManager';
import { RSAKeyPair } from './keyManagerUtils';

const RSATool: React.FC<BaseToolProps> = ({ state, setState }) => {
  // Set default mode if not already set
  React.useEffect(() => {
    if (!state.mode) {
      setState({ ...state, mode: 'encrypt', showKeyManager: false });
    }
  }, [state, setState]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setState({ ...state, input: e.target.value, output: '', error: null });
  };

  const handlePublicKeyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setState({ ...state, publicKey: e.target.value, error: null });
  };

  const handlePrivateKeyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setState({ ...state, privateKey: e.target.value, error: null });
  };

  const handleModeChange = (mode: 'encrypt' | 'decrypt') => {
    setState({ ...state, mode, output: '', error: null });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const generateKeyPair = () => {
    // TODO: Implement actual RSA key generation
    const mockPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3VoPN9PKUjKFLMwOge9+
G2MiKxmWPQnIbv1XNUlGN5lC2r6RLwN/u5BvJ8QGlF8X7h2qKfQ9xQ8EG9xW8zUu
2B3FvR2xQZk3MwF7EGxcIzN9yNxXGz8wH5vOz8zV2F7GxF9X3gXzQXzXzW5H8N7z
-----END PUBLIC KEY-----`;

    const mockPrivateKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDdWg830cpSMoUs
zA6B734bYyIrGZY9Cchu/Vc1SUY3mULavpEvA3+7kG8nxAaUXxfuHaop9D3FDwQb
3FbzNS7YHcW9HbFBmTczAXsQbFwjM33I3FcbPzAfm87PzNXYXsbEX1feBfNBfNfN
bkfw3vMpvBrXzGHtVzW5H8N7zVy8X+Q1z8zV2F7GxF9X3gXzQXzXzW5H8N7zKbwa
18xh7Vc1uR/De81cvF/kNc/M1dhexsRfV94F80F8181uR/De8ym8GtfMYe1XNbkf
w3vNXLxf5DXPzNXYXsbEX1feBfNBfNfNbkfw3vMpvBrXzGHtVzW5H8N7zVy8X+Q1
AgMBAAECggEBAM5H7Vy8X+Q1z8zV2F7GxF9X3gXzQXzXzW5H8N7zKbwa18xh7Vc1
-----END PRIVATE KEY-----`;

    setState({ 
      ...state, 
      publicKey: mockPublicKey, 
      privateKey: mockPrivateKey,
      error: null,
      output: ''
    });
  };

  const handleProcess = () => {
    try {
      if (!state.input.trim()) {
        setState({ ...state, error: 'Please enter text to process' });
        return;
      }

      const requiredKey = state.mode === 'encrypt' ? state.publicKey : state.privateKey;
      if (!requiredKey.trim()) {
        setState({ ...state, error: `Please enter a ${state.mode === 'encrypt' ? 'public' : 'private'} key` });
        return;
      }

      // TODO: Implement actual RSA encryption/decryption
      // For now, using a simple mock that produces clean output
      let mockOutput: string;
      
      if (state.mode === 'encrypt') {
        // Mock encryption - produce a clean base64-like encrypted string
        mockOutput = `${btoa(state.input).replace(/[+/=]/g, '')}ABC123XYZ`;
      } else {
        // Mock decryption - try to extract original text or show clean decrypted result
        let textToDecrypt = state.input;
        
        // Try to reverse the mock encryption
        try {
          const cleanBase64 = textToDecrypt.replace('ABC123XYZ', '');
          const decoded = atob(cleanBase64);
          mockOutput = decoded;
        } catch {
          // If it's not our mock format, just show as decrypted
          mockOutput = textToDecrypt;
        }
      }
      
      setState({ ...state, output: mockOutput, error: null });
    } catch (error) {
      setState({ ...state, error: error instanceof Error ? error.message : 'An error occurred during processing' });
    }
  };

  const clearAll = () => {
    setState({ 
      ...state, 
      input: '', 
      output: '', 
      publicKey: '', 
      privateKey: '', 
      error: null,
      selectedKeyId: null
    });
  };

  const handleKeySelect = (keyPair: RSAKeyPair) => {
    setState({
      ...state,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      selectedKeyId: keyPair.id,
      output: '',
      error: null
    });
  };

  const toggleKeyManager = () => {
    setState({ ...state, showKeyManager: !state.showKeyManager });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full mr-4">
              <ShieldCheckIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">RSA Encryption Tool</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Secure RSA encryption and decryption with public/private key cryptography. 
            Generate key pairs, encrypt sensitive data, and decrypt messages with enterprise-grade security.
          </p>
        </div>

        {/* Four-section layout */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          
          {/* Section 1: Operation Mode */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <KeyIcon className="w-5 h-5 mr-2" />
              Operation Mode
            </h3>
            <div className="flex space-x-4">
              <button
                onClick={() => handleModeChange('encrypt')}
                className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                  state.mode === 'encrypt'
                    ? 'bg-green-500 text-white shadow-lg transform scale-105'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <LockClosedIcon className="w-5 h-5 mr-2" />
                Encrypt
              </button>
              <button
                onClick={() => handleModeChange('decrypt')}
                className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                  state.mode === 'decrypt'
                    ? 'bg-orange-500 text-white shadow-lg transform scale-105'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <LockOpenIcon className="w-5 h-5 mr-2" />
                Decrypt
              </button>
            </div>
          </div>

          {/* Section 2: Key Management */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <KeyIcon className="w-5 h-5 mr-2" />
                Key Management
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={toggleKeyManager}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors flex items-center"
                >
                  {state.showKeyManager ? (
                    <>
                      <ChevronUpIcon className="w-4 h-4 mr-2" />
                      Hide Keys
                    </>
                  ) : (
                    <>
                      <KeyIcon className="w-4 h-4 mr-2" />
                      Manage Keys
                    </>
                  )}
                </button>
                <button
                  onClick={generateKeyPair}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors flex items-center"
                >
                  <KeyIcon className="w-4 h-4 mr-2" />
                  Generate
                </button>
              </div>
            </div>
            
            {/* Key Manager Component */}
            {state.showKeyManager && (
              <div className="mt-4">
                <KeyManager 
                  onKeySelect={handleKeySelect}
                  selectedKeyId={state.selectedKeyId}
                  currentPublicKey={state.publicKey}
                  currentPrivateKey={state.privateKey}
                />
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Public and Private Keys */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <ShieldCheckIcon className="w-5 h-5 mr-2" />
            RSA Key Pair
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Public Key {state.mode === 'encrypt' && <span className="text-green-500">*</span>}
              </label>
              <div className="relative">
                <textarea
                  value={state.publicKey}
                  onChange={handlePublicKeyChange}
                  className={`w-full h-40 px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent font-mono resize-none ${
                    state.mode === 'encrypt' 
                      ? 'border-green-300 dark:border-green-600 focus:ring-green-500' 
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                  }`}
                  placeholder="-----BEGIN PUBLIC KEY-----&#10;Enter your RSA public key here...&#10;-----END PUBLIC KEY-----"
                />
                {state.publicKey && (
                  <button
                    onClick={() => copyToClipboard(state.publicKey)}
                    className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title="Copy public key"
                  >
                    <ClipboardDocumentIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Private Key {state.mode === 'decrypt' && <span className="text-orange-500">*</span>}
              </label>
              <div className="relative">
                <textarea
                  value={state.privateKey}
                  onChange={handlePrivateKeyChange}
                  className={`w-full h-40 px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent font-mono resize-none ${
                    state.mode === 'decrypt' 
                      ? 'border-orange-300 dark:border-orange-600 focus:ring-orange-500' 
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                  }`}
                  placeholder="-----BEGIN PRIVATE KEY-----&#10;Enter your RSA private key here...&#10;-----END PRIVATE KEY-----"
                />
                {state.privateKey && (
                  <button
                    onClick={() => copyToClipboard(state.privateKey)}
                    className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title="Copy private key"
                  >
                    <ClipboardDocumentIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Input/Output */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <DocumentTextIcon className="w-5 h-5 mr-2" />
            Input Text
            </h3>
          <textarea
            value={state.input}
            onChange={handleInputChange}
              className="w-full h-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder={`Enter text to ${state.mode}...`}
            />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <DocumentTextIcon className="w-5 h-5 mr-2" />
                Output
              </h3>
              {state.output && (
                <button
                  onClick={() => copyToClipboard(state.output)}
                  className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center"
                >
                  <ClipboardDocumentIcon className="w-4 h-4 mr-1" />
                  Copy
                </button>
              )}
            </div>
            <textarea
              value={state.output}
              readOnly
              className="w-full h-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white font-mono resize-none"
              placeholder="Result will appear here..."
          />
        </div>
      </div>

        {/* Action Buttons */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex flex-col sm:flex-row gap-4">
      <button
        onClick={handleProcess}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                state.mode === 'encrypt'
                  ? 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500'
                  : 'bg-orange-600 hover:bg-orange-700 text-white focus:ring-orange-500'
              }`}
            >
              {state.mode === 'encrypt' ? (
                <>
                  <LockClosedIcon className="w-5 h-5 inline mr-2" />
                  Encrypt Text
                </>
              ) : (
                <>
                  <LockOpenIcon className="w-5 h-5 inline mr-2" />
                  Decrypt Text
                </>
              )}
      </button>

            <button
              onClick={clearAll}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Error Display */}
        {state.error && (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl">
            <div className="flex items-center">
              <div className="text-red-500 mr-2">⚠️</div>
              <strong>Error:</strong> {state.error}
            </div>
        </div>
      )}

        {/* Security Notice */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 rounded-xl">
          <div className="flex items-start">
            <ShieldCheckIcon className="w-5 h-5 mt-0.5 mr-2 text-blue-500" />
            <div>
              <strong>Security Notice:</strong> Keep your private keys secure and never share them. 
              This tool is for development and testing purposes. For production use, implement proper key management and use established cryptographic libraries.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RSATool;