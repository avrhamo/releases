import React, { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { Tab } from '@headlessui/react';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClipboardDocumentIcon,
  KeyIcon,
  ShieldCheckIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  PlusIcon,
  ArrowPathIcon,
  CalendarIcon,
  UserIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';

interface JWTState {
  token: string;
  decodedHeader: any;
  decodedPayload: any;
  signature: string | null;
  isVerified: boolean | null;
  error: string | null;
  secret: string;
  algorithm: string;
}

interface Props {
  state: JWTState;
  setState: (state: Partial<JWTState>) => void;
}

// Helper functions for JWT operations
const base64UrlEncode = (str: string): string => {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

const base64UrlDecode = (str: string): string => {
  try {
    // Replace URL-safe characters and add padding if needed
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    
    // Decode base64 and handle UTF-8
    const decoded = atob(base64);
    return decodeURIComponent(escape(decoded));
  } catch (error) {
    throw new Error('Invalid base64url encoding');
  }
};

const hmacSha256 = async (message: string, secret: string): Promise<string> => {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
};

const JWTTool: React.FC<Props> = ({ state, setState }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  
  // Generation form state
  const [generateForm, setGenerateForm] = useState({
    payload: '{\n  "sub": "1234567890",\n  "name": "John Doe",\n  "iat": ' + Math.floor(Date.now() / 1000) + ',\n  "exp": ' + (Math.floor(Date.now() / 1000) + 3600) + '\n}',
    secret: 'your-256-bit-secret',
    algorithm: 'HS256'
  });

  // Initialize default values if not set
  useEffect(() => {
    if (!state.algorithm) {
      setState({ algorithm: 'HS256' });
    }
    if (!state.secret) {
      setState({ secret: 'your-256-bit-secret' });
    }
  }, [state.algorithm, state.secret, setState]);

  const handleTokenChange = (token: string) => {
    setState({ token, error: null, isVerified: null });
    try {
      if (token.trim()) {
        // First try using jwt-decode library
        const decoded = jwtDecode(token);
        
        // Manually decode header
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
          throw new Error('Invalid token format - must have 3 parts separated by dots');
        }
        
        const headerB64 = tokenParts[0];
        const header = JSON.parse(base64UrlDecode(headerB64));
        
        setState({
          decodedHeader: header,
          decodedPayload: decoded,
          signature: tokenParts[2] || null,
        });
      } else {
        setState({
          decodedHeader: null,
          decodedPayload: null,
          signature: null,
        });
      }
    } catch (error) {
      setState({ 
        error: `Invalid JWT token format: ${error instanceof Error ? error.message : 'Unknown error'}`,
        decodedHeader: null,
        decodedPayload: null,
        signature: null
      });
    }
  };

  const handleVerify = async () => {
    if (!state.token || !state.secret) {
      setState({ error: 'Token and secret are required' });
      return;
    }

    setIsVerifying(true);
    try {
      const tokenParts = state.token.split('.');
      if (tokenParts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const [headerB64, payloadB64, signatureB64] = tokenParts;
      const header = JSON.parse(base64UrlDecode(headerB64));
      
      // Only support HMAC algorithms for now
      if (!header.alg.startsWith('HS')) {
        throw new Error('Only HMAC algorithms (HS256, HS384, HS512) are currently supported');
      }

      if (header.alg !== state.algorithm) {
        setState({ 
          isVerified: false, 
          error: `Token algorithm (${header.alg}) doesn't match selected algorithm (${state.algorithm})` 
        });
        return;
      }

      // Create the signature
      const message = `${headerB64}.${payloadB64}`;
      let computedSignature: string;

      switch (header.alg) {
        case 'HS256':
          computedSignature = await hmacSha256(message, state.secret);
          break;
        default:
          throw new Error(`Algorithm ${header.alg} not implemented yet`);
      }

      const isValid = computedSignature === signatureB64;
      setState({ 
        isVerified: isValid, 
        error: isValid ? null : 'Invalid signature - token has been tampered with or wrong secret' 
      });

    } catch (error) {
      setState({ 
        isVerified: false, 
        error: error instanceof Error ? error.message : 'Verification failed' 
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const generateToken = async () => {
    if (!generateForm.secret.trim()) {
      setState({ error: 'Secret is required for token generation' });
      return;
    }

    setIsGenerating(true);
    try {
      // Parse and validate payload
      let payload;
      try {
        payload = JSON.parse(generateForm.payload);
      } catch {
        throw new Error('Invalid JSON in payload');
      }

      // Create header
      const header = {
        alg: generateForm.algorithm,
        typ: 'JWT'
      };

      // Encode header and payload
      const headerB64 = base64UrlEncode(JSON.stringify(header));
      const payloadB64 = base64UrlEncode(JSON.stringify(payload));
      const message = `${headerB64}.${payloadB64}`;

      // Generate signature
      let signature: string;
      switch (generateForm.algorithm) {
        case 'HS256':
          signature = await hmacSha256(message, generateForm.secret);
          break;
        default:
          throw new Error(`Algorithm ${generateForm.algorithm} not implemented yet`);
      }

      // Create final token
      const token = `${message}.${signature}`;
      
      // Update state with new token
      setState({ 
        token,
        secret: generateForm.secret,
        algorithm: generateForm.algorithm,
        error: null,
        isVerified: null
      });
      
      // Auto-decode the generated token
      handleTokenChange(token);
      
      // Switch to decode tab
      setActiveTab(0);

    } catch (error) {
      setState({ 
        error: error instanceof Error ? error.message : 'Token generation failed' 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const renderPayloadInfo = () => {
    if (!state.decodedPayload) return null;
    
    const { exp, iat, nbf, iss, aud, sub } = state.decodedPayload;
    const now = Math.floor(Date.now() / 1000);
    const isExpired = exp && exp < now;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {exp && (
          <div className={`col-span-full flex items-center p-4 rounded-lg ${
            isExpired 
              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800' 
              : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
          }`}>
            {isExpired ? (
              <ExclamationTriangleIcon className="h-6 w-6 mr-3 flex-shrink-0" />
            ) : (
              <CheckCircleIcon className="h-6 w-6 mr-3 flex-shrink-0" />
            )}
            <div className="flex-1">
              <div className="font-semibold text-lg">
                {isExpired ? 'Token Expired' : 'Token Valid'}
              </div>
              <div className="text-sm opacity-75 flex items-center mt-1">
                <CalendarIcon className="h-4 w-4 mr-1" />
                Expires: {formatDate(exp)}
              </div>
            </div>
          </div>
        )}
        
        <div className="space-y-3">
          {iat && (
            <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <CalendarIcon className="h-5 w-5 text-gray-500 mr-3" />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">Issued At</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{formatDate(iat)}</div>
              </div>
            </div>
          )}
          
          {sub && (
            <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <UserIcon className="h-5 w-5 text-gray-500 mr-3" />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">Subject</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{sub}</div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {iss && (
            <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <BuildingOfficeIcon className="h-5 w-5 text-gray-500 mr-3" />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">Issuer</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{iss}</div>
              </div>
            </div>
          )}
          
          {aud && (
            <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <UserIcon className="h-5 w-5 text-gray-500 mr-3" />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">Audience</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{Array.isArray(aud) ? aud.join(', ') : aud}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center">
          <ShieldCheckIcon className="h-8 w-8 text-blue-600 dark:text-blue-400 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">JWT Tool</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Generate, decode and verify JSON Web Tokens</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
      <Tab.Group selectedIndex={activeTab} onChange={setActiveTab}>
          <Tab.List className="flex space-x-1 rounded-xl bg-white dark:bg-gray-800 p-1 shadow-sm border border-gray-200 dark:border-gray-700 max-w-md mx-auto">
            <Tab
              className={({ selected }) =>
                `flex-1 rounded-lg py-3 px-4 text-sm font-medium leading-5 transition-all duration-200 flex items-center justify-center space-x-2
                ${selected
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 shadow-md text-white transform scale-105'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'
                }`
              }
            >
              <CodeBracketIcon className="h-4 w-4" />
              <span>Decode</span>
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
              <ShieldCheckIcon className="h-4 w-4" />
              <span>Verify</span>
          </Tab>
          <Tab
            className={({ selected }) =>
                `flex-1 rounded-lg py-3 px-4 text-sm font-medium leading-5 transition-all duration-200 flex items-center justify-center space-x-2
              ${selected
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 shadow-md text-white transform scale-105'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'
              }`
            }
          >
              <PlusIcon className="h-4 w-4" />
              <span>Generate</span>
          </Tab>
        </Tab.List>

          <Tab.Panels className="mt-6 flex-1">
            {/* Decode Tab */}
            <Tab.Panel className="h-full">
              <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 h-full">
                {/* Token Input */}
                <div className="xl:col-span-2">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 h-full">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <DocumentTextIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                        <label htmlFor="jwt-token-input" className="text-lg font-semibold text-gray-900 dark:text-white">
                JWT Token
              </label>
                      </div>
                      {state.token && (
                        <button
                          onClick={() => copyToClipboard(state.token)}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Copy token"
                        >
                          <ClipboardDocumentIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    
              <textarea
                      className="w-full h-64 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none font-mono text-sm transition-all duration-200"
                value={state.token}
                onChange={(e) => handleTokenChange(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
                      id="jwt-token-input"
                      aria-label="JWT Token Input"
              />
                    
                    {copied && (
                      <div className="mt-3 text-sm text-green-600 dark:text-green-400 flex items-center">
                        <CheckCircleIcon className="h-4 w-4 mr-1" />
                        Copied to clipboard!
            </div>
                    )}
            
            {state.error && (
                      <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800">
                        <div className="flex items-center">
                          <XCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                          <span className="text-sm">{state.error}</span>
                        </div>
              </div>
            )}
                  </div>
                </div>

                {/* Decoded Content */}
                <div className="xl:col-span-3">
                  {state.decodedHeader ? (
                    <div className="space-y-6 h-full">
                      {/* Token Info */}
                      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                          <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                          Token Information
                        </h3>
                        {renderPayloadInfo()}
                      </div>

                      {/* Header and Payload */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                            <KeyIcon className="h-5 w-5 text-blue-500 mr-2" />
                            Header
                          </h3>
                          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-auto max-h-64">
                            <pre className="text-sm text-gray-800 dark:text-gray-200 font-mono">
                    {JSON.stringify(state.decodedHeader, null, 2)}
                  </pre>
                </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                            <DocumentTextIcon className="h-5 w-5 text-green-500 mr-2" />
                            Payload
                          </h3>
                          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-auto max-h-64">
                            <pre className="text-sm text-gray-800 dark:text-gray-200 font-mono">
                    {JSON.stringify(state.decodedPayload, null, 2)}
                  </pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center h-full flex items-center justify-center">
                      <div>
                        <ShieldCheckIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                          Ready to Decode
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          Paste a JWT token to see its decoded header and payload
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
          </Tab.Panel>

            {/* Verify Tab */}
            <Tab.Panel className="h-full">
              <div className="max-w-4xl mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-8 flex items-center">
                    <ShieldCheckIcon className="h-7 w-7 text-green-500 mr-3" />
                    Verify JWT Token
                  </h2>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          JWT Token
                        </label>
                        <textarea
                          className="w-full h-32 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white resize-none font-mono text-sm"
                          value={state.token}
                          onChange={(e) => handleTokenChange(e.target.value)}
                          placeholder="Paste your JWT token here..."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Secret Key
              </label>
                        <div className="relative">
              <input
                            type={showSecret ? 'text' : 'password'}
                            className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white font-mono"
                value={state.secret}
                onChange={(e) => setState({ secret: e.target.value })}
                            placeholder="your-256-bit-secret"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSecret(!showSecret)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            {showSecret ? (
                              <EyeSlashIcon className="h-5 w-5" />
                            ) : (
                              <EyeIcon className="h-5 w-5" />
                            )}
                          </button>
                        </div>
            </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Algorithm
              </label>
              <select
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                value={state.algorithm}
                onChange={(e) => setState({ algorithm: e.target.value })}
                          title="Select JWT signing algorithm"
                        >
                          <option value="HS256">HS256 (HMAC SHA-256)</option>
                          <option value="HS384">HS384 (HMAC SHA-384)</option>
                          <option value="HS512">HS512 (HMAC SHA-512)</option>
                          <option value="RS256">RS256 (RSA SHA-256)</option>
                          <option value="RS384">RS384 (RSA SHA-384)</option>
                          <option value="RS512">RS512 (RSA SHA-512)</option>
              </select>
            </div>

            <button
              onClick={handleVerify}
                        disabled={!state.token || !state.secret || isVerifying}
                        className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-lg shadow-md hover:from-green-600 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
                      >
                        <div className="flex items-center justify-center">
                          {isVerifying ? (
                            <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                          ) : (
                            <ShieldCheckIcon className="h-5 w-5 mr-2" />
                          )}
                          {isVerifying ? 'Verifying...' : 'Verify Token'}
                        </div>
            </button>
                    </div>

                    <div className="space-y-6">
            {state.isVerified !== null && (
                        <div className={`p-6 rounded-xl border-2 transition-all duration-300 ${
                state.isVerified
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
              }`}>
                          <div className="flex items-start">
                {state.isVerified ? (
                              <CheckCircleIcon className="h-8 w-8 mr-3 flex-shrink-0 mt-1" />
                            ) : (
                              <XCircleIcon className="h-8 w-8 mr-3 flex-shrink-0 mt-1" />
                            )}
                            <div>
                              <h4 className="text-xl font-semibold mb-2">
                                {state.isVerified ? 'Token is Valid ✅' : 'Token is Invalid ❌'}
                              </h4>
                              <p className="text-sm opacity-90 leading-relaxed">
                                {state.isVerified 
                                  ? 'The token signature is valid and has not been tampered with. The secret key matches and the token is authentic.'
                                  : state.error || 'The token signature could not be verified.'
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Additional info about verification */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-2">How Verification Works</h5>
                        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                          <li>• The signature is computed using the header and payload</li>
                          <li>• HMAC algorithms use the secret key for signing</li>
                          <li>• The computed signature is compared with the token's signature</li>
                          <li>• If they match, the token is authentic and unmodified</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Tab.Panel>

            {/* Generate Tab */}
            <Tab.Panel className="h-full">
              <div className="max-w-6xl mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-8 flex items-center">
                    <PlusIcon className="h-7 w-7 text-purple-500 mr-3" />
                    Generate JWT Token
                  </h2>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          Payload (JSON)
                        </label>
                        <textarea
                          className="w-full h-64 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white resize-none font-mono text-sm"
                          value={generateForm.payload}
                          onChange={(e) => setGenerateForm({ ...generateForm, payload: e.target.value })}
                          placeholder='{\n  "sub": "1234567890",\n  "name": "John Doe",\n  "iat": 1516239022\n}'
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          Secret Key
                        </label>
                        <input
                          type="text"
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white font-mono"
                          value={generateForm.secret}
                          onChange={(e) => setGenerateForm({ ...generateForm, secret: e.target.value })}
                          placeholder="your-256-bit-secret"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          Algorithm
                        </label>
                        <select
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
                          value={generateForm.algorithm}
                          onChange={(e) => setGenerateForm({ ...generateForm, algorithm: e.target.value })}
                          title="Select JWT signing algorithm"
                        >
                          <option value="HS256">HS256 (HMAC SHA-256)</option>
                          <option value="HS384">HS384 (HMAC SHA-384)</option>
                          <option value="HS512">HS512 (HMAC SHA-512)</option>
                        </select>
                      </div>

                      <button
                        onClick={generateToken}
                        disabled={!generateForm.secret.trim() || isGenerating}
                        className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-lg shadow-md hover:from-purple-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95"
                      >
                        <div className="flex items-center justify-center">
                          {isGenerating ? (
                            <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                          ) : (
                            <PlusIcon className="h-5 w-5 mr-2" />
                          )}
                          {isGenerating ? 'Generating...' : 'Generate Token'}
                        </div>
                      </button>
                    </div>

                    <div className="space-y-6">
                      {/* Generated Token Display */}
                      {state.token && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Generated Token
                          </label>
                          <div className="relative">
                            <textarea
                              className="w-full h-32 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm dark:bg-gray-700 dark:text-white resize-none font-mono text-sm"
                              value={state.token}
                              readOnly
                            />
                            <button
                              onClick={() => copyToClipboard(state.token)}
                              className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                              title="Copy token"
                            >
                              <ClipboardDocumentIcon className="h-4 w-4" />
                            </button>
                          </div>
              </div>
            )}

                      {/* Token Generation Info */}
                      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                        <h5 className="font-medium text-purple-900 dark:text-purple-100 mb-2">Token Generation</h5>
                        <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1">
                          <li>• Header contains algorithm and token type</li>
                          <li>• Payload contains your custom claims and data</li>
                          <li>• Signature ensures token authenticity</li>
                          <li>• Generated token will appear in the Decode tab</li>
                        </ul>
                      </div>

                      {/* Common Claims Info */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                        <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Common JWT Claims</h5>
                        <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                          <div><code>iss</code> - Issuer of the token</div>
                          <div><code>sub</code> - Subject (user ID)</div>
                          <div><code>aud</code> - Intended audience</div>
                          <div><code>exp</code> - Expiration time (Unix timestamp)</div>
                          <div><code>iat</code> - Issued at time (Unix timestamp)</div>
                          <div><code>nbf</code> - Not before time (Unix timestamp)</div>
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

export default JWTTool; 