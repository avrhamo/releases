import * as React from 'react';
const { useState, useCallback } = React;
import { BaseToolProps } from '../types';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ShieldCheckIcon,
  KeyIcon,
  DocumentArrowUpIcon,
  CommandLineIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';

declare global {
  interface Window {
    electronAPI: {
      readFile: (path: string) => Promise<{ success: boolean; content: any; error?: string }>;
      processKeytab: (content: ArrayBuffer) => Promise<{
        success: boolean;
        entries: KeytabEntry[];
        error?: string;
      }>;
      processCreateKeytab: (params: {
        principal: string;
        password: string;
        encryptionType: string;
        kvno: number;
        outputPath?: string;
      }) => Promise<{
        success: boolean;
        error?: string;
        filePath?: string;
      }>;
    };
  }
}

interface KeytabEntry {
  principal: string;
  kvno: number;
  timestamp: string;
  encryptionType: string;
}

interface KeytabState {
  entries: KeytabEntry[];
  error: string | null;
  fileName: string | null;
  isProcessing: boolean;
}

type KeytabStatus = 'healthy' | 'warning' | 'expired' | 'invalid' | 'unknown';

interface KeytabAnalysis {
  status: KeytabStatus;
  message: string;
  daysUntilExpiration?: number;
  hasMultiplePrincipals: boolean;
  encryptionTypes: string[];
  oldestEntry?: KeytabEntry;
  newestEntry?: KeytabEntry;
}

const Keytab: React.FC<BaseToolProps> = ({ state, setState }) => {
  // Ensure state has proper defaults
  const keytabState = {
    entries: [],
    error: null,
    fileName: null,
    isProcessing: false,
    ...state
  };
  const [dragActive, setDragActive] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  // State for create keytab form
  const [createForm, setCreateForm] = useState({
    principal: '',
    password: '',
    encryptionType: 'aes256-cts-hmac-sha1-96',
    kvno: 1,
    realm: '',
    serviceName: '',
    hostname: '',
    outputPath: '',
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Analyze keytab health and status
  const analyzeKeytab = useCallback((entries: KeytabEntry[]): KeytabAnalysis => {
    if (!entries || entries.length === 0) {
      return {
        status: 'invalid',
        message: 'No entries found in keytab file',
        hasMultiplePrincipals: false,
        encryptionTypes: []
      };
    }

    const principals = Array.from(new Set(entries.map(e => e.principal)));
    const encryptionTypes = Array.from(new Set(entries.map(e => e.encryptionType)));
    const sortedEntries = [...entries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    const oldestEntry = sortedEntries[0];
    const newestEntry = sortedEntries[sortedEntries.length - 1];

    // Check for structural issues and encryption types
    const hasModernEncryption = encryptionTypes.some(type => 
      type.toLowerCase().includes('aes') || type.toLowerCase().includes('sha')
    );
    const hasWeakEncryption = encryptionTypes.some(type => 
      type.toLowerCase().includes('des') || type.toLowerCase().includes('rc4')
    );
    
    let status: KeytabStatus = 'healthy';
    let message = 'Keytab structure is valid';
    let daysUntilExpiration: number | undefined;

    // Note: Keytab timestamps are key version numbers, not expiration dates
    // Real expiration testing requires KDC connection
    if (!hasModernEncryption && hasWeakEncryption) {
      status = 'warning';
      message = 'Contains only weak encryption types (DES/RC4)';
    } else if (hasWeakEncryption) {
      status = 'warning';  
      message = 'Contains some weak encryption types';
    }

    // Check for suspicious timestamp patterns
    const years = entries.map(e => new Date(e.timestamp).getFullYear());
    const hasUnusualYears = years.some(year => year > 2030 || year < 1990);
    
    if (hasUnusualYears) {
      status = status === 'healthy' ? 'warning' : status;
      message = message + ' (unusual timestamps detected)';
    }

    return {
      status,
      message,
      daysUntilExpiration,
      hasMultiplePrincipals: principals.length > 1,
      encryptionTypes,
      oldestEntry,
      newestEntry
    };
  }, []);

  const processKeytabFile = useCallback(async (file: File) => {
    try {
      // Clear previous state completely when processing new file
      setState(prev => ({ 
        entries: [], 
        error: null, 
        fileName: null, 
        isProcessing: true 
      }));
      
      const content = await file.arrayBuffer();
      
      // Check if electronAPI is available
      if (!window.electronAPI || !window.electronAPI.processKeytab) {
        throw new Error('Keytab processing API not available. This feature requires the desktop app.');
      }
      
      const result = await window.electronAPI.processKeytab(content);
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          entries: result.entries,
          fileName: file.name,
          error: null,
          isProcessing: false
        }));
      } else {
        throw new Error(result.error || 'Failed to process keytab file');
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'An error occurred while processing the keytab file',
        isProcessing: false
      }));
    }
  }, [setState]);

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCommand(label);
      setTimeout(() => setCopiedCommand(null), 2000);
    } catch (err) {
      // Copy failed silently
    }
  }, []);

  const clearKeytabState = useCallback(() => {
    setState({
      entries: [],
      error: null,
      fileName: null,
      isProcessing: false
    });
  }, [setState]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const hasFiles = e.dataTransfer.types.includes('Files');
    const hasUriList = e.dataTransfer.types.includes('text/uri-list') || 
                      e.dataTransfer.types.includes('application/vnd.code.uri-list');
    
    if (e.type === "dragenter" || e.type === "dragover") {
      if (hasFiles || hasUriList) {
        e.dataTransfer.dropEffect = 'copy';
        setDragActive(true);
      }
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    try {
      let fileToProcess: File | null = null;

      if (e.dataTransfer.files.length > 0) {
        fileToProcess = e.dataTransfer.files[0];
      } else if (e.dataTransfer.items.length > 0) {
        for (let i = 0; i < e.dataTransfer.items.length; i++) {
          const item = e.dataTransfer.items[i];
          if (item.kind === 'string') {
            const str = await new Promise<string>((resolve) => {
              item.getAsString((s) => resolve(s));
            });

            if (str.startsWith('file://')) {
              const filePath = decodeURIComponent(str.replace('file://', ''));
              const result = await window.electronAPI.readFile(filePath);
              if (result.success) {
                const fileName = filePath.split('/').pop() || 'keytab';
                const fileContent = new Uint8Array(result.content);
                fileToProcess = new File([fileContent], fileName, { type: 'application/octet-stream' });
                break;
              }
            } else if (str.startsWith('/')) {
              const filePath = str;
              const result = await window.electronAPI.readFile(filePath);
              if (result.success) {
                const fileName = filePath.split('/').pop() || 'keytab';
                const fileContent = new Uint8Array(result.content);
                fileToProcess = new File([fileContent], fileName, { type: 'application/octet-stream' });
                break;
              }
            }
          }
        }
      }

      if (fileToProcess) {
        await processKeytabFile(fileToProcess);
      } else {
        setState(prev => ({
          ...prev,
          error: 'No valid file was dropped. Please try dragging the file from Finder instead of the editor.',
          isProcessing: false
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'An error occurred while processing the dropped file',
        isProcessing: false
      }));
    }
  }, [processKeytabFile, setState]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processKeytabFile(files[0]);
    }
  }, [processKeytabFile]);

  const handleCreateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCreateForm(f => {
      const newForm = {
      ...f,
      [name]: name === 'kvno' ? Number(value) : value,
      };
      
      // Auto-generate principal if service and hostname are filled
      if ((name === 'serviceName' || name === 'hostname' || name === 'realm') && 
          newForm.serviceName && newForm.hostname && newForm.realm) {
        newForm.principal = `${newForm.serviceName}/${newForm.hostname}@${newForm.realm}`;
      }
      
      return newForm;
    });
    setCreateError(null);
    setCreateSuccess(null);
  };

  const generateServicePrincipal = (service: string, hostname: string, realm: string) => {
    if (!service || !hostname || !realm) return '';
    return `${service}/${hostname}@${realm}`;
  };

  const getCommonServices = () => [
    { value: 'HTTP', label: 'HTTP (Web Services)', example: 'HTTP/server.example.com@REALM.COM' },
    { value: 'LDAP', label: 'LDAP (Directory Services)', example: 'LDAP/ldap.example.com@REALM.COM' },
    { value: 'host', label: 'Host (SSH/Telnet)', example: 'host/server.example.com@REALM.COM' },
    { value: 'cifs', label: 'CIFS (File Sharing)', example: 'cifs/fileserver.example.com@REALM.COM' },
    { value: 'nfs', label: 'NFS (Network File System)', example: 'nfs/nfsserver.example.com@REALM.COM' },
    { value: 'postgres', label: 'PostgreSQL', example: 'postgres/db.example.com@REALM.COM' },
    { value: 'oracle', label: 'Oracle Database', example: 'oracle/db.example.com@REALM.COM' },
  ];

  const getEncryptionTypes = () => [
    { value: 'aes256-cts-hmac-sha1-96', label: 'AES-256 (Recommended)', description: 'Strong encryption, widely supported' },
    { value: 'aes128-cts-hmac-sha1-96', label: 'AES-128', description: 'Good balance of security and performance' },
    { value: 'des3-cbc-sha1', label: 'DES3', description: 'Legacy encryption, use only if required' },
    // Note: RC4/ARCFOUR not supported by macOS ktutil
  ];

  const handleCreateKeytab = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    
    if (!createForm.principal.trim()) {
      setCreateError('Principal is required.');
      return;
    }
    if (!createForm.password) {
      setCreateError('Password is required.');
      return;
    }
    if (!createForm.encryptionType) {
      setCreateError('Encryption type is required.');
      return;
    }
    
    setIsCreating(true);
    try {
      const result = await window.electronAPI.processCreateKeytab({
        principal: createForm.principal.trim(),
        password: createForm.password,
        encryptionType: createForm.encryptionType,
        kvno: createForm.kvno || 1,
        outputPath: createForm.outputPath || undefined,
      });
      if (result.success) {
        setCreateSuccess(`Keytab file created successfully!${result.filePath ? ` Saved to: ${result.filePath}` : ''}`);
      } else {
        setCreateError(result.error || 'Failed to create keytab file.');
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create keytab file.');
    } finally {
      setIsCreating(false);
    }
  };

  // Analyze current keytab
  const analysis = keytabState.entries && keytabState.entries.length > 0 ? analyzeKeytab(keytabState.entries) : null;
  

  const getStatusIcon = (status: KeytabStatus) => {
    switch (status) {
      case 'healthy': return <CheckCircleIcon className="w-12 h-12 text-green-500" />;
      case 'warning': return <ExclamationTriangleIcon className="w-12 h-12 text-yellow-500" />;
      case 'expired': return <XCircleIcon className="w-12 h-12 text-red-500" />;
      case 'invalid': return <XCircleIcon className="w-12 h-12 text-red-500" />;
      default: return <ShieldCheckIcon className="w-12 h-12 text-gray-400" />;
    }
  };

  const getStatusColor = (status: KeytabStatus) => {
    switch (status) {
      case 'healthy': return 'border-green-500 bg-green-50 dark:bg-green-900/20';
      case 'warning': return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'expired': return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      case 'invalid': return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      default: return 'border-gray-300 bg-gray-50 dark:bg-gray-800';
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-8 min-h-screen">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4 flex items-center justify-center">
          <KeyIcon className="w-10 h-10 mr-4 text-blue-600" />
          Keytab Validator
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Analyze keytab file structure, check principals and encryption types. 
          <span className="text-sm block mt-2 text-gray-500 dark:text-gray-400">
            Note: Full authentication testing requires access to your Kerberos KDC server.
          </span>
        </p>
      </div>

            {/* Main Upload Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Upload Keytab File</h3>
          {(keytabState.entries?.length > 0 || keytabState.error || keytabState.fileName) && (
            <button
              onClick={clearKeytabState}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              title="Clear current results"
            >
              Clear Results
            </button>
          )}
        </div>
        
        <div
          className={`relative border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-all duration-200 ${
            dragActive
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 scale-[1.02]'
              : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="keytab-file"
            className="hidden"
            accept=".keytab"
            onChange={handleFileSelect}
          />
          <label htmlFor="keytab-file" className="flex flex-col items-center justify-center cursor-pointer">
            <DocumentArrowUpIcon className="w-20 h-20 mb-6 text-blue-400 dark:text-blue-300" />
            <span className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-2">
              Drop your keytab file here
            </span>
            <span className="text-lg text-gray-500 dark:text-gray-400">
              or <span className="underline text-blue-600 dark:text-blue-400">click to select</span>
            </span>
            <div className="mt-4 text-sm text-gray-400 dark:text-gray-500">
              Supported: .keytab files
            </div>
          </label>
        </div>
      </div>

      {/* Processing State */}
      {keytabState.isProcessing && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-8 border border-blue-200 dark:border-blue-700">
          <div className="flex items-center justify-center space-x-4">
            <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-xl font-semibold text-blue-700 dark:text-blue-300">
              Analyzing keytab file...
            </span>
          </div>
        </div>
      )}

      {/* Error State */}
      {keytabState.error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-2xl p-8">
          <div className="flex items-center">
            <XCircleIcon className="w-12 h-12 text-red-600 mr-6" />
            <div>
              <h3 className="text-2xl font-semibold text-red-800 dark:text-red-300 mb-2 select-text">Analysis Failed</h3>
              <p className="text-lg text-red-700 dark:text-red-400 select-text error-message">{keytabState.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty Keytab Warning - only show if we actually processed a file */}
      {keytabState.fileName && keytabState.entries && keytabState.entries.length === 0 && !keytabState.isProcessing && !keytabState.error && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-2xl p-8">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="w-12 h-12 text-yellow-600 mr-6" />
            <div>
              <h3 className="text-2xl font-semibold text-yellow-800 dark:text-yellow-300 mb-2 select-text">
                ⚠️ Empty Keytab File
              </h3>
              <p className="text-lg text-yellow-700 dark:text-yellow-400 mb-4 select-text warning-message">
                No entries found in this keytab file ({keytabState.fileName}).
              </p>
              <div className="text-sm text-yellow-600 dark:text-yellow-500 space-y-2 select-text">
                <p><strong>Possible causes:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>The keytab file is corrupted or empty</li>
                  <li>Wrong file format (not a valid keytab)</li>
                  <li>File was created but principals were never added</li>
                  <li>Keytab was created with a different tool/version</li>
                </ul>
                <p className="mt-4"><strong>Try:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Re-creating the keytab using the form below</li>
                  <li>Verifying the file with: <code className="bg-yellow-100 dark:bg-yellow-800 px-2 py-1 rounded select-all">klist -k {keytabState.fileName}</code></li>
                  <li>Using a different keytab file</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && keytabState.entries && keytabState.entries.length > 0 && (
        <div className={`border-2 rounded-2xl p-8 ${getStatusColor(analysis.status)}`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-6">
              {getStatusIcon(analysis.status)}
              <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {analysis.status === 'healthy' && '✅ Keytab is Valid'}
                  {analysis.status === 'warning' && '⚠️ Warning Detected'}
                  {analysis.status === 'expired' && '❌ Keytab Expired'}
                  {analysis.status === 'invalid' && '❌ Invalid Keytab'}
                </h2>
                <p className="text-lg text-gray-700 dark:text-gray-300">{analysis.message}</p>
              </div>
            </div>
            {keytabState.fileName && (
              <div className="text-right">
                <div className="text-sm text-gray-500 dark:text-gray-400">File:</div>
                <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">{keytabState.fileName}</div>
              </div>
            )}
          </div>

          {/* Key Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <KeyIcon className="w-8 h-8 text-blue-600" />
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Principals</div>
                  <div className="text-xl font-semibold text-gray-900 dark:text-white">
                    {analysis.hasMultiplePrincipals ? `${Array.from(new Set(keytabState.entries?.map(e => e.principal) || [])).length} found` : '1 found'}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <ShieldCheckIcon className="w-8 h-8 text-green-600" />
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Encryption</div>
                  <div className="text-xl font-semibold text-gray-900 dark:text-white">
                    {analysis.encryptionTypes.join(', ')}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <ClockIcon className="w-8 h-8 text-purple-600" />
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Entries</div>
                  <div className="text-xl font-semibold text-gray-900 dark:text-white">
                    {keytabState.entries?.length || 0} total
                  </div>
                </div>
              </div>
            </div>

            {analysis.daysUntilExpiration !== undefined && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-3">
                  <ExclamationTriangleIcon className="w-8 h-8 text-yellow-600" />
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Expires In</div>
                    <div className="text-xl font-semibold text-gray-900 dark:text-white">
                      {analysis.daysUntilExpiration} days
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Principal List */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 mb-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 select-text">Principals Found</h3>
            <div className="space-y-2">
              {Array.from(new Set(keytabState.entries?.map(e => e.principal) || [])).map((principal, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <code className="text-lg font-mono text-gray-900 dark:text-gray-100 select-all">{principal}</code>
                  <button
                    onClick={() => copyToClipboard(String(principal), 'principal')}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    title="Copy principal"
                  >
                    <ClipboardDocumentIcon className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Troubleshooting Commands */}
          <div className="bg-gray-900 dark:bg-black rounded-xl p-6 border border-gray-700">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <CommandLineIcon className="w-6 h-6 mr-3" />
              Troubleshooting Commands
            </h3>
            <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-200 select-text">
                <strong>Note:</strong> Authentication testing (kinit) requires network access to your Kerberos KDC server. 
                The commands below will only work if you're on a network that can reach your domain controllers.
              </p>
            </div>
        <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-400 mb-2 select-text">Test keytab authentication:</div>
                <div className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
                  <code className="text-green-400 font-mono select-all">
                    kinit -kt {keytabState.fileName || 'keytab.file'} {keytabState.entries?.[0]?.principal}
                  </code>
                  <button
                    onClick={() => copyToClipboard(`kinit -kt ${keytabState.fileName || 'keytab.file'} ${keytabState.entries?.[0]?.principal}`, 'kinit')}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                    title="Copy command"
                  >
                    {copiedCommand === 'kinit' ? <CheckCircleIcon className="w-5 h-5 text-green-400" /> : <ClipboardDocumentIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              <div>
                <div className="text-sm text-gray-400 mb-2 select-text">List keytab contents:</div>
                <div className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
                  <code className="text-green-400 font-mono select-all">
                    klist -k {keytabState.fileName || 'keytab.file'}
                  </code>
                  <button
                    onClick={() => copyToClipboard(`klist -k ${keytabState.fileName || 'keytab.file'}`, 'klist')}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                    title="Copy command"
                  >
                    {copiedCommand === 'klist' ? <CheckCircleIcon className="w-5 h-5 text-green-400" /> : <ClipboardDocumentIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-400 mb-2 select-text">Check current tickets:</div>
                <div className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
                  <code className="text-green-400 font-mono select-all">klist</code>
                  <button
                    onClick={() => copyToClipboard('klist', 'klist-current')}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                    title="Copy command"
                  >
                    {copiedCommand === 'klist-current' ? <CheckCircleIcon className="w-5 h-5 text-green-400" /> : <ClipboardDocumentIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Secondary: Create Keytab */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="w-full p-6 flex items-center justify-between text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-center space-x-4">
            <KeyIcon className="w-8 h-8 text-gray-600 dark:text-gray-400" />
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Create New Keytab</h3>
              <p className="text-gray-600 dark:text-gray-400">Generate a keytab file from principal and password</p>
            </div>
          </div>
          {showCreateForm ? (
            <ChevronUpIcon className="w-6 h-6 text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-6 h-6 text-gray-400" />
          )}
        </button>

        {showCreateForm && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-6">
            <form onSubmit={handleCreateKeytab} className="space-y-8">
              
              {/* Service Principal Builder */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-700">
                <h4 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-4">
                  🛠️ Service Principal Builder
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Service Type
                    </label>
                    <select
                      name="serviceName"
                      value={createForm.serviceName}
                      onChange={handleCreateChange}
                      title="Select service type for principal"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select service...</option>
                      {getCommonServices().map(service => (
                        <option key={service.value} value={service.value}>
                          {service.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Hostname/FQDN
                    </label>
                    <input
                      type="text"
                      name="hostname"
                      value={createForm.hostname}
                      onChange={handleCreateChange}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      placeholder="server.example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Realm
                    </label>
                    <input
                      type="text"
                      name="realm"
                      value={createForm.realm}
                      onChange={handleCreateChange}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      placeholder="EXAMPLE.COM"
                    />
                  </div>
                </div>
                {createForm.serviceName && createForm.hostname && createForm.realm && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Generated Principal:</div>
                    <code className="text-lg font-mono text-blue-600 dark:text-blue-400">
                      {generateServicePrincipal(createForm.serviceName, createForm.hostname, createForm.realm)}
                    </code>
                  </div>
                )}
              </div>

              {/* Manual Principal Entry */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Principal <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="principal"
                  value={createForm.principal}
                  onChange={handleCreateChange}
                  className="w-full px-4 py-3 text-lg border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="testuser@TEST.REALM or HTTP/server.example.com@REALM.COM"
                  required
                />
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Enter manually or use the service principal builder above
                </div>
              </div>

              {/* Authentication */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={createForm.password}
                      onChange={handleCreateChange}
                      className="w-full px-4 py-3 text-lg border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                      required
                      placeholder="Password"
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Key Version Number (KVNO)
                  </label>
                  <input
                    type="number"
                    name="kvno"
                    value={createForm.kvno}
                    onChange={handleCreateChange}
                    min="1"
                    max="999"
                    className="w-full px-4 py-3 text-lg border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="1"
                  />
                </div>
              </div>

              {/* Advanced Options */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Encryption Type
                </label>
                <select
                  name="encryptionType"
                  value={createForm.encryptionType}
                  onChange={handleCreateChange}
                  title="Select encryption type for keytab"
                  className="w-full px-4 py-3 text-lg border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  {getEncryptionTypes().map(enc => (
                    <option key={enc.value} value={enc.value}>
                      {enc.label} - {enc.description}
                    </option>
                  ))}
                </select>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 select-text">
                  Note: Only encryption types supported by macOS ktutil are available. RC4/ARCFOUR is not supported.
                </div>
              </div>

              {/* Output Options */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Output Path (Optional)
                </label>
                <input
                  type="text"
                  name="outputPath"
                  value={createForm.outputPath}
                  onChange={handleCreateChange}
                  className="w-full px-4 py-3 text-lg border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="/path/to/output.keytab (leave empty for default)"
                />
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  If not specified, will be saved to Downloads folder
                </div>
              </div>

              {createError && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl">
                  <div className="select-text error-message">{createError}</div>
                </div>
              )}

              {createSuccess && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl">
                  <div className="select-text success-message">{createSuccess}</div>
                </div>
              )}

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-8 py-3 rounded-xl text-lg font-semibold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className={`px-8 py-3 rounded-xl text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
                    isCreating
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                  }`}
                >
                  {isCreating ? 'Creating...' : 'Create Keytab'}
                </button>
              </div>
            </form>
        </div>
      )}
      </div>
    </div>
  );
};

export default Keytab;