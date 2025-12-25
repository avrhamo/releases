# RSA Tool Key Management

The RSA Tool now includes a comprehensive key management system that allows users to save, edit, and manage up to 10 RSA key pairs.

## Features

### Key Storage
- **Local Storage**: Keys are securely stored in the browser's localStorage
- **Maximum Capacity**: Up to 10 key pairs can be saved
- **Automatic Organization**: Keys are automatically sorted by last usage

### Key Management Operations

#### Adding Keys
1. Click "Manage Saved Keys" to open the key manager
2. Click "Add Key" button
3. Enter a unique name for your key pair
4. Paste your public and private keys
5. Click "Save Key"

#### Using Saved Keys
1. Open the key manager
2. Click the duplicate icon (📋) next to any saved key
3. The keys will be automatically loaded into the main interface
4. The selected key will be marked as "Active"

#### Editing Keys
1. Click the edit icon (✏️) next to any saved key
2. Modify the name or key content as needed
3. Click "Save" to confirm changes
4. Click "Cancel" to discard changes

#### Deleting Keys
1. Click the trash icon (🗑️) next to any saved key
2. Click again to confirm deletion (3-second timeout for safety)

### Import/Export
- **Export**: Download all saved keys as a JSON file
- **Import**: Upload previously exported keys from a JSON file
- Duplicate names are automatically handled during import

### Security Notes
- Keys are stored locally in your browser only
- No keys are transmitted to external servers
- Consider the security implications of storing private keys in browser storage
- For production use, implement proper key management practices

## Technical Implementation

### Files
- `keyManager.ts`: Core key management logic and localStorage interface
- `KeyManager.tsx`: React component for the key management UI
- `index.tsx` & `RSA.tsx`: Main RSA tool components with integrated key management

### API
The key manager exposes methods for:
- `saveKey()`: Save a new key pair
- `updateKey()`: Update an existing key
- `deleteKey()`: Remove a key
- `useKey()`: Mark a key as recently used
- `exportKeys()`: Export all keys to JSON
- `importKeys()`: Import keys from JSON
