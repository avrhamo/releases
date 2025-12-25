import React, { useState, useEffect } from 'react';
import { 
  KeyIcon, 
  TrashIcon, 
  PencilIcon, 
  PlusIcon, 
  DocumentDuplicateIcon, 
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { rsaKeyManager, RSAKeyPair } from './keyManagerUtils';

interface KeyManagerProps {
  onKeySelect?: (keyPair: RSAKeyPair) => void;
  selectedKeyId?: string;
  currentPublicKey?: string;
  currentPrivateKey?: string;
}

interface EditingKey {
  id: string;
  name: string;
  publicKey: string;
  privateKey: string;
}

const KeyManager: React.FC<KeyManagerProps> = ({ onKeySelect, selectedKeyId, currentPublicKey, currentPrivateKey }) => {
  const [keys, setKeys] = useState<RSAKeyPair[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingKey, setEditingKey] = useState<EditingKey | null>(null);
  const [newKey, setNewKey] = useState({ name: '', publicKey: '', privateKey: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showImportExport, setShowImportExport] = useState(false);
  const [importData, setImportData] = useState('');

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = () => {
    setKeys(rsaKeyManager.getAllKeys());
  };

  const showMessage = (message: string, isError = false) => {
    if (isError) {
      setError(message);
      setSuccess(null);
    } else {
      setSuccess(message);
      setError(null);
    }
    setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 3000);
  };

  const handleSaveNew = () => {
    try {
      const savedKey = rsaKeyManager.saveKey(newKey.name, newKey.publicKey, newKey.privateKey);
      setNewKey({ name: '', publicKey: '', privateKey: '' });
      setIsCreating(false);
      loadKeys();
      showMessage(`Key "${savedKey.name}" saved successfully!`);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Failed to save key', true);
    }
  };

  const handleUpdateKey = () => {
    if (!editingKey) return;
    
    try {
      const updatedKey = rsaKeyManager.updateKey(editingKey.id, {
        name: editingKey.name,
        publicKey: editingKey.publicKey,
        privateKey: editingKey.privateKey
      });
      setEditingKey(null);
      loadKeys();
      showMessage(`Key "${updatedKey.name}" updated successfully!`);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Failed to update key', true);
    }
  };

  const handleDeleteKey = (id: string) => {
    const key = keys.find(k => k.id === id);
    if (!key) return;

    if (deleteConfirm === id) {
      try {
        rsaKeyManager.deleteKey(id);
        loadKeys();
        setDeleteConfirm(null);
        showMessage(`Key "${key.name}" deleted successfully!`);
      } catch (error) {
        showMessage('Failed to delete key', true);
      }
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const handleSelectKey = (key: RSAKeyPair) => {
    rsaKeyManager.useKey(key.id); // Updates lastUsed
    loadKeys(); // Refresh to show updated order
    onKeySelect?.(key);
  };

  const handleExport = () => {
    try {
      const exportData = rsaKeyManager.exportKeys();
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rsa-keys-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showMessage('Keys exported successfully!');
    } catch (error) {
      showMessage('Failed to export keys', true);
    }
  };

  const handleImport = () => {
    try {
      const imported = rsaKeyManager.importKeys(importData);
      loadKeys();
      setImportData('');
      setShowImportExport(false);
      showMessage(`Successfully imported ${imported} key(s)!`);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Failed to import keys', true);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const canSaveNew = newKey.name.trim() && newKey.publicKey.trim() && newKey.privateKey.trim();
  const canUpdateKey = editingKey && editingKey.name.trim() && editingKey.publicKey.trim() && editingKey.privateKey.trim();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <KeyIcon className="w-5 h-5 mr-2" />
          Saved Keys ({keys.length}/{rsaKeyManager.getMaxKeys()})
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowImportExport(!showImportExport)}
            className="px-3 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center"
          >
            <ArrowUpTrayIcon className="w-4 h-4 mr-1" />
            Import/Export
          </button>
          <button
            onClick={() => {
              if (!isCreating) {
                // Pre-fill with current keys when opening the form
                setNewKey({ 
                  name: '', 
                  publicKey: currentPublicKey || '', 
                  privateKey: currentPrivateKey || '' 
                });
              }
              setIsCreating(!isCreating);
            }}
            disabled={keys.length >= rsaKeyManager.getMaxKeys()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Key
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg flex items-center">
          <ExclamationTriangleIcon className="w-5 h-5 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-lg">
          ✓ {success}
        </div>
      )}

      {/* Import/Export Section */}
      {showImportExport && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Import/Export Keys</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <button
                onClick={handleExport}
                disabled={keys.length === 0}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                Export All Keys
              </button>
            </div>
            <div className="space-y-2">
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="Paste exported JSON data here..."
                className="w-full h-20 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
              />
              <button
                onClick={handleImport}
                disabled={!importData.trim()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                <ArrowUpTrayIcon className="w-4 h-4 mr-2" />
                Import Keys
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Key Form */}
      {isCreating && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900 dark:text-white">Add New Key</h4>
            {(currentPublicKey || currentPrivateKey) && (
              <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded-full">
                Current keys auto-filled
              </span>
            )}
          </div>
          <div className="space-y-3">
            <input
              type="text"
              value={newKey.name}
              onChange={(e) => setNewKey({...newKey, name: e.target.value})}
              placeholder="Key name (e.g., 'Development', 'Production')"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <textarea
              value={newKey.publicKey}
              onChange={(e) => setNewKey({...newKey, publicKey: e.target.value})}
              placeholder="Public key"
              className="w-full h-24 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono resize-none"
            />
            <textarea
              value={newKey.privateKey}
              onChange={(e) => setNewKey({...newKey, privateKey: e.target.value})}
              placeholder="Private key"
              className="w-full h-24 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono resize-none"
            />
            <div className="flex space-x-2">
              <button
                onClick={handleSaveNew}
                disabled={!canSaveNew}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Save Key
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewKey({ name: '', publicKey: '', privateKey: '' });
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keys List */}
      <div className="space-y-3">
        {keys.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <KeyIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No saved keys yet. Add your first key to get started!</p>
          </div>
        ) : (
          keys.map((key) => (
            <div key={key.id} className={`border rounded-lg p-4 transition-all ${
              selectedKeyId === key.id 
                ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            }`}>
              {editingKey?.id === key.id ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Key Name
                    </label>
                    <input
                      type="text"
                      value={editingKey.name}
                      onChange={(e) => setEditingKey({...editingKey, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="Enter key name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Public Key
                    </label>
                    <textarea
                      value={editingKey.publicKey}
                      onChange={(e) => setEditingKey({...editingKey, publicKey: e.target.value})}
                      className="w-full h-20 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono resize-none"
                      placeholder="Enter public key"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Private Key
                    </label>
                    <textarea
                      value={editingKey.privateKey}
                      onChange={(e) => setEditingKey({...editingKey, privateKey: e.target.value})}
                      className="w-full h-20 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono resize-none"
                      placeholder="Enter private key"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleUpdateKey}
                      disabled={!canUpdateKey}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingKey(null)}
                      className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <h4 className="font-medium text-gray-900 dark:text-white">{key.name}</h4>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleSelectKey(key)}
                        className={`px-3 py-2 rounded-lg font-medium transition-all duration-200 flex items-center ${
                          selectedKeyId === key.id
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800'
                        }`}
                        title={selectedKeyId === key.id ? "Currently active" : "Use this key"}
                      >
                        <DocumentDuplicateIcon className="w-4 h-4 mr-1" />
                        {selectedKeyId === key.id ? 'Active' : 'Use Key'}
                      </button>
                      <button
                        onClick={() => setEditingKey({
                          id: key.id,
                          name: key.name,
                          publicKey: key.publicKey,
                          privateKey: key.privateKey
                        })}
                        className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"
                        title="Edit key"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteKey(key.id)}
                        className={`p-1 transition-colors ${
                          deleteConfirm === key.id
                            ? 'text-red-800 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded'
                            : 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300'
                        }`}
                        title={deleteConfirm === key.id ? 'Click again to confirm deletion' : 'Delete key'}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <div>Created: {formatDate(key.createdAt)}</div>
                    <div>Last used: {formatDate(key.lastUsed)}</div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {keys.length >= rsaKeyManager.getMaxKeys() && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 rounded-lg">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
            <span>Maximum number of keys reached ({rsaKeyManager.getMaxKeys()}). Delete some keys to add new ones.</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default KeyManager;
