// Key management utility for RSA Tool
export interface RSAKeyPair {
  id: string;
  name: string;
  publicKey: string;
  privateKey: string;
  createdAt: number;
  lastUsed: number;
}

const STORAGE_KEY = 'rsa-keys';
const MAX_KEYS = 10;

export class RSAKeyManager {
  private static instance: RSAKeyManager;
  private keys: RSAKeyPair[] = [];

  private constructor() {
    this.loadKeys();
  }

  static getInstance(): RSAKeyManager {
    if (!RSAKeyManager.instance) {
      RSAKeyManager.instance = new RSAKeyManager();
    }
    return RSAKeyManager.instance;
  }

  private loadKeys(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.keys = JSON.parse(stored);
        // Sort by lastUsed desc
        this.keys.sort((a, b) => b.lastUsed - a.lastUsed);
      }
    } catch (error) {
      this.keys = [];
    }
  }

  private saveKeys(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.keys));
    } catch (error) {
      throw new Error('Failed to save keys. Storage might be full.');
    }
  }

  getAllKeys(): RSAKeyPair[] {
    return [...this.keys];
  }

  getKey(id: string): RSAKeyPair | undefined {
    return this.keys.find(key => key.id === id);
  }

  saveKey(name: string, publicKey: string, privateKey: string): RSAKeyPair {
    if (this.keys.length >= MAX_KEYS) {
      throw new Error(`Maximum of ${MAX_KEYS} keys allowed. Please delete some keys first.`);
    }

    if (!name.trim()) {
      throw new Error('Key name is required');
    }

    if (!publicKey.trim() || !privateKey.trim()) {
      throw new Error('Both public and private keys are required');
    }

    // Check for duplicate names
    if (this.keys.some(key => key.name.toLowerCase() === name.toLowerCase().trim())) {
      throw new Error('A key with this name already exists');
    }

    const newKey: RSAKeyPair = {
      id: this.generateId(),
      name: name.trim(),
      publicKey: publicKey.trim(),
      privateKey: privateKey.trim(),
      createdAt: Date.now(),
      lastUsed: Date.now()
    };

    this.keys.unshift(newKey); // Add to beginning
    this.saveKeys();
    return newKey;
  }

  updateKey(id: string, updates: Partial<Omit<RSAKeyPair, 'id' | 'createdAt'>>): RSAKeyPair {
    const keyIndex = this.keys.findIndex(key => key.id === id);
    if (keyIndex === -1) {
      throw new Error('Key not found');
    }

    // Validate name uniqueness if name is being updated
    if (updates.name !== undefined) {
      const trimmedName = updates.name.trim();
      if (!trimmedName) {
        throw new Error('Key name is required');
      }
      if (this.keys.some((key, index) => 
        index !== keyIndex && key.name.toLowerCase() === trimmedName.toLowerCase()
      )) {
        throw new Error('A key with this name already exists');
      }
      updates.name = trimmedName;
    }

    // Validate keys if being updated
    if (updates.publicKey !== undefined && !updates.publicKey.trim()) {
      throw new Error('Public key cannot be empty');
    }
    if (updates.privateKey !== undefined && !updates.privateKey.trim()) {
      throw new Error('Private key cannot be empty');
    }

    const updatedKey = {
      ...this.keys[keyIndex],
      ...updates,
      lastUsed: Date.now()
    };

    this.keys[keyIndex] = updatedKey;
    
    // Move to front if it was updated
    if (keyIndex > 0) {
      this.keys.splice(keyIndex, 1);
      this.keys.unshift(updatedKey);
    }
    
    this.saveKeys();
    return updatedKey;
  }

  deleteKey(id: string): boolean {
    const keyIndex = this.keys.findIndex(key => key.id === id);
    if (keyIndex === -1) {
      return false;
    }

    this.keys.splice(keyIndex, 1);
    this.saveKeys();
    return true;
  }

  useKey(id: string): RSAKeyPair | undefined {
    const key = this.getKey(id);
    if (key) {
      // Update lastUsed and move to front
      key.lastUsed = Date.now();
      const keyIndex = this.keys.findIndex(k => k.id === id);
      if (keyIndex > 0) {
        this.keys.splice(keyIndex, 1);
        this.keys.unshift(key);
      }
      this.saveKeys();
    }
    return key;
  }

  clearAllKeys(): void {
    this.keys = [];
    this.saveKeys();
  }

  private generateId(): string {
    return `rsa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getKeyCount(): number {
    return this.keys.length;
  }

  getMaxKeys(): number {
    return MAX_KEYS;
  }

  exportKeys(): string {
    return JSON.stringify(this.keys, null, 2);
  }

  importKeys(jsonData: string): number {
    try {
      const importedKeys: RSAKeyPair[] = JSON.parse(jsonData);
      
      if (!Array.isArray(importedKeys)) {
        throw new Error('Invalid format: expected an array of keys');
      }

      let imported = 0;
      const errors: string[] = [];

      for (const key of importedKeys) {
        try {
          if (this.keys.length + imported >= MAX_KEYS) {
            errors.push(`Maximum of ${MAX_KEYS} keys reached`);
            break;
          }

          // Validate key structure
          if (!key.name || !key.publicKey || !key.privateKey) {
            errors.push(`Skipped invalid key: ${key.name || 'unnamed'}`);
            continue;
          }

          // Check for duplicate names
          const nameExists = this.keys.some(existingKey => 
            existingKey.name.toLowerCase() === key.name.toLowerCase()
          );
          
          if (nameExists) {
            errors.push(`Skipped duplicate key name: ${key.name}`);
            continue;
          }

          // Create new key with fresh ID and timestamps
          const newKey: RSAKeyPair = {
            id: this.generateId(),
            name: key.name.trim(),
            publicKey: key.publicKey.trim(),
            privateKey: key.privateKey.trim(),
            createdAt: Date.now(),
            lastUsed: Date.now()
          };

          this.keys.push(newKey);
          imported++;
        } catch (error) {
          errors.push(`Error importing key ${key.name || 'unnamed'}: ${error}`);
        }
      }

      if (imported > 0) {
        this.saveKeys();
      }

      if (errors.length > 0) {
        console.warn('Import errors:', errors);
      }

      return imported;
    } catch (error) {
      throw new Error(`Failed to import keys: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
    }
  }
}

export const rsaKeyManager = RSAKeyManager.getInstance();
