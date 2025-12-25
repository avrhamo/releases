"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const mongodb_1 = require("mongodb");
const kafkajs_1 = require("kafkajs");
const path = __importStar(require("path"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const crypto_1 = __importDefault(require("crypto"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
let mainWindow = null;
let mongoClient = null;
let kafkaClient = null;
let kafkaProducer = null;
let kafkaConsumer = null;
const activeCursors = new Map();
const activeConsumers = new Map();
const activeBatches = new Map();
const isDev = !electron_1.app.isPackaged || process.env.NODE_ENV === 'development';
const execAsync = (0, util_1.promisify)(child_process_1.exec);
// Encryption key management
let encryptionKey = null;
// Load or generate encryption key
async function loadEncryptionKey() {
    try {
        const keyPath = path.join(electron_1.app.getPath('userData'), 'encryption.key');
        if (fs.existsSync(keyPath)) {
            encryptionKey = await fs.promises.readFile(keyPath);
        }
        else {
            // Generate new key if none exists
            encryptionKey = crypto_1.default.randomBytes(32); // 256 bits
            await fs.promises.writeFile(keyPath, encryptionKey);
        }
    }
    catch (error) {
        throw error;
    }
}
async function createWindow() {
    // Log the preload script path
    const preloadPath = path.join(__dirname, 'preload.js');
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'build/icons/icon.ico'), // Use .ico for Windows taskbar
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: preloadPath
        },
    });
    // Add debugging for preload script loading
    mainWindow.webContents.on('did-finish-load', () => {
    });
    mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
    });
    // Set up error handling
    mainWindow.webContents.on('render-process-gone', () => {
    });
    // Prevent navigation to external URLs and open them in default browser instead
    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        if (parsedUrl.origin !== 'http://localhost:5173' && parsedUrl.origin !== 'file://') {
            event.preventDefault();
            electron_1.shell.openExternal(navigationUrl);
        }
    });
    // Prevent new windows from opening and open external URLs in system browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        electron_1.shell.openExternal(url);
        return { action: 'deny' };
    });
    if (isDev) {
        // In development, use the Vite dev server
        await mainWindow.loadURL('http://localhost:5173');
        // Only open dev tools in development
        mainWindow.webContents.openDevTools();
    }
    else {
        // In production, load the built files
        // When packaged by electron-builder:
        // - Files are in app.asar archive
        // - __dirname points to the asar archive root
        // - dist files are at the root level of the asar
        console.log('Loading production app...');
        console.log('__dirname:', __dirname);
        console.log('process.resourcesPath:', process.resourcesPath);
        console.log('app.isPackaged:', electron_1.app.isPackaged);
        console.log('app.getAppPath():', electron_1.app.getAppPath());
        // For packaged apps, use the unpacked dist files
        // __dirname points to app.asar, but unpacked files are in app.asar.unpacked
        // The process.resourcesPath points to the resources directory
        const indexPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'index.html');
        try {
            console.log('Attempting to load from:', indexPath);
            await mainWindow.loadFile(indexPath);
            console.log('Successfully loaded from:', indexPath);
        }
        catch (error) {
            console.error('Failed to load from:', indexPath);
            console.error('Error details:', error);
            // Fallback: Try loading with URL if file loading fails
            try {
                const fileUrl = `file://${indexPath.replace(/\\/g, '/')}`;
                console.log('Trying URL loading as fallback:', fileUrl);
                await mainWindow.loadURL(fileUrl);
                console.log('Successfully loaded via URL');
            }
            catch (urlError) {
                console.error('URL loading also failed:', urlError);
                throw new Error(`Could not load index.html from ${indexPath}. Original error: ${error.message}`);
            }
        }
    }
}
// Helper function to deeply convert ObjectId fields to strings
function convertObjectIds(obj) {
    if (Array.isArray(obj)) {
        return obj.map(convertObjectIds);
    }
    else if (obj && typeof obj === 'object') {
        // Handle native ObjectId
        if (obj._bsontype === 'ObjectID' && typeof obj.toString === 'function') {
            return obj.toString();
        }
        // Handle buffer-like ObjectId (from serialization)
        if (obj.buffer && Object.keys(obj.buffer).length === 12) {
            try {
                // Try to reconstruct ObjectId from buffer if needed
                const { ObjectId } = require('mongodb');
                return new ObjectId(Buffer.from(Object.values(obj.buffer))).toString();
            }
            catch {
                // Fallback: return as is
                return obj;
            }
        }
        const newObj = {};
        for (const key in obj) {
            newObj[key] = convertObjectIds(obj[key]);
        }
        return newObj;
    }
    return obj;
}
// MongoDB IPC Handlers
electron_1.ipcMain.handle('mongodb:connect', async (_, connectionString) => {
    try {
        mongoClient = new mongodb_1.MongoClient(connectionString);
        await mongoClient.connect();
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('mongodb:findOne', async (_, database, collection, query) => {
    try {
        if (!mongoClient)
            throw new Error('Not connected to MongoDB');
        const db = mongoClient.db(database);
        const col = db.collection(collection);
        const document = await col.findOne(query || {});
        const cleanDoc = convertObjectIds(document);
        return { success: true, document: cleanDoc };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
    }
});
electron_1.ipcMain.handle('mongodb:listDatabases', async () => {
    try {
        if (!mongoClient)
            throw new Error('Not connected to MongoDB');
        const admin = mongoClient.db().admin();
        const result = await admin.listDatabases();
        return { success: true, databases: result.databases };
    }
    catch (error) {
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: 'An unknown error occurred' };
    }
});
electron_1.ipcMain.handle('mongodb:listCollections', async (_, dbName) => {
    try {
        if (!mongoClient)
            throw new Error('Not connected to MongoDB');
        const db = mongoClient.db(dbName);
        const collections = await db.listCollections().toArray();
        return { success: true, collections };
    }
    catch (error) {
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: 'An unknown error occurred' };
    }
});
// Cursor Management
electron_1.ipcMain.handle('mongodb:createCursor', async (_, dbName, collectionName, query = {}) => {
    try {
        if (!mongoClient)
            throw new Error('Not connected to MongoDB');
        const db = mongoClient.db(dbName);
        const collection = db.collection(collectionName);
        const cursor = collection.find(query);
        // Generate a unique cursor ID
        const cursorId = Date.now().toString();
        activeCursors.set(cursorId, cursor);
        return {
            success: true,
            cursorId,
            totalCount: await cursor.count()
        };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('mongodb:getNextBatch', async (_, cursorId, batchSize) => {
    try {
        const cursor = activeCursors.get(cursorId);
        if (!cursor)
            throw new Error('Cursor not found');
        const documents = await cursor.next(batchSize);
        return {
            success: true,
            documents,
            hasMore: await cursor.hasNext()
        };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('mongodb:closeCursor', async (_, cursorId) => {
    try {
        const cursor = activeCursors.get(cursorId);
        if (cursor) {
            await cursor.close();
            activeCursors.delete(cursorId);
        }
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// New IPC handler for batch initialization
electron_1.ipcMain.handle('mongodb:initializeBatch', async (_, { database, collection, query = {}, batchSize = 100 }) => {
    try {
        if (!mongoClient)
            throw new Error('Not connected to MongoDB');
        const db = mongoClient.db(database);
        const col = db.collection(collection);
        // Parse the query if provided
        let parsedQuery = {};
        if (typeof query === 'string') {
            try {
                parsedQuery = JSON.parse(query);
            }
            catch (e) {
                console.warn('Failed to parse query:', e);
            }
        }
        else {
            parsedQuery = query;
        }
        // Create cursor and get total count
        const cursor = col.find(parsedQuery);
        const totalCount = await cursor.count();
        // Generate a unique batch ID
        const batchId = crypto_1.default.randomUUID();
        // Initialize batch state
        const batchState = {
            cursor,
            currentBatch: [],
            batchSize,
            hasMore: true,
            totalCount,
            currentIndex: 0
        };
        // Store the batch state
        activeBatches.set(batchId, batchState);
        // Load first batch
        await loadNextBatch(batchId);
        return {
            success: true,
            batchId,
            totalCount,
            hasMore: batchState.hasMore
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to initialize batch'
        };
    }
});
// Helper function to load next batch
async function loadNextBatch(batchId) {
    const batchState = activeBatches.get(batchId);
    if (!batchState)
        throw new Error('Batch not found');
    const { cursor, batchSize } = batchState;
    // Clear current batch
    batchState.currentBatch = [];
    batchState.currentIndex = 0;
    // Fetch next batch
    for (let i = 0; i < batchSize; i++) {
        const doc = await cursor.next();
        if (!doc) {
            batchState.hasMore = false;
            break;
        }
        batchState.currentBatch.push(doc);
    }
}
// New IPC handler to get next document from batch
electron_1.ipcMain.handle('mongodb:getNextDocument', async (_, batchId) => {
    try {
        const batchState = activeBatches.get(batchId);
        if (!batchState)
            throw new Error('Batch not found');
        const { currentBatch, currentIndex, hasMore, totalCount } = batchState;
        // If we've reached the end of current batch and there are more documents
        if (currentIndex >= currentBatch.length && hasMore) {
            await loadNextBatch(batchId);
        }
        // If we still have documents in the current batch
        if (currentIndex < batchState.currentBatch.length) {
            const doc = batchState.currentBatch[currentIndex];
            batchState.currentIndex++;
            return {
                success: true,
                document: convertObjectIds(doc),
                hasMore: batchState.hasMore || currentIndex < batchState.currentBatch.length - 1,
                totalCount
            };
        }
        return {
            success: true,
            document: null,
            hasMore: false,
            totalCount
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get next document'
        };
    }
});
// New IPC handler to close batch
electron_1.ipcMain.handle('mongodb:closeBatch', async (_, batchId) => {
    try {
        const batchState = activeBatches.get(batchId);
        if (batchState) {
            await batchState.cursor.close();
            activeBatches.delete(batchId);
        }
        return { success: true };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to close batch'
        };
    }
});
// API Request Execution Handler
electron_1.ipcMain.handle('api:executeRequest', async (_, config) => {
    const startTime = Date.now();
    try {
        const { method = 'GET', url, headers = {}, data, mappedFields, connectionConfig, batchId } = config;
        // First, get a document from the current batch
        let mongoValues = {};
        if (Object.keys(mappedFields).length > 0 && batchId) {
            const batchState = activeBatches.get(batchId);
            if (!batchState) {
                throw new Error('Batch not found');
            }
            const { currentBatch, currentIndex, hasMore } = batchState;
            // If we've reached the end of current batch and there are more documents
            if (currentIndex >= currentBatch.length && hasMore) {
                await loadNextBatch(batchId);
            }
            // Get the next document
            const doc = currentIndex < batchState.currentBatch.length
                ? batchState.currentBatch[currentIndex]
                : null;
            if (doc) {
                batchState.currentIndex++; // Increment the index for next request
                // Create a map of curl fields to their MongoDB values
                mongoValues = Object.entries(mappedFields).reduce((acc, [curlField, fieldConfig]) => {
                    // Handle special values first
                    if (fieldConfig === 'specialValue') {
                        acc[curlField] = crypto_1.default.randomUUID();
                        return acc;
                    }
                    // Handle MongoDB field paths
                    let value = doc;
                    if (typeof fieldConfig === 'string') {
                        // Split the field path to get the specific field we want
                        const fieldParts = fieldConfig.split('.');
                        // Navigate to the specific field in the document
                        for (const key of fieldParts) {
                            value = value?.[key];
                        }
                        // Only use the specific field value, not the entire document
                        acc[curlField] = value;
                    }
                    else {
                        acc[curlField] = value;
                    }
                    return acc;
                }, {});
            }
        }
        // Now populate the request with MongoDB values
        let populatedUrl = url;
        let populatedHeaders = { ...headers };
        let populatedData = data;
        console.log('Initial request data:', {
            method,
            url,
            headers,
            data,
            dataType: typeof data
        });
        // Replace URL parameters
        console.log('Processing URL parameters:', {
            url: populatedUrl,
            mongoValues,
            hasUrlParams: populatedUrl.includes('{$P')
        });
        // First try to match any {$P...} pattern in the URL
        const matches = populatedUrl.match(/\{\$P[^}]+\}/g);
        if (matches) {
            console.log('Found URL parameter matches:', matches);
            matches.forEach((match) => {
                // Extract the placeholder ID from the {$P...} format
                const placeholderId = match.slice(3, -1); // Remove {$P and }
                console.log('Processing URL parameter:', { match, placeholderId });
                // Look for a field that maps to this path parameter
                const mappedField = Object.entries(mongoValues).find(([field, value]) => {
                    // The field should be a path parameter mapping
                    return field.startsWith('url.pathParams.') &&
                        field.endsWith(placeholderId);
                });
                if (mappedField) {
                    const [field, value] = mappedField;
                    console.log('Found path parameter mapping:', {
                        match,
                        placeholderId,
                        field,
                        value
                    });
                    populatedUrl = populatedUrl.replace(match, value.toString());
                }
                else {
                    console.log('No path parameter mapping found:', {
                        match,
                        placeholderId,
                        availableFields: Object.keys(mongoValues)
                    });
                    throw new Error(`No mapping found for path parameter ${match}. Available fields: ${Object.keys(mongoValues).join(', ')}`);
                }
            });
        }
        // Then handle explicit field mappings
        Object.entries(mongoValues).forEach(([field, value]) => {
            if (field.startsWith('url.')) {
                const paramName = field.split('.')[1];
                populatedUrl = populatedUrl.replace(`{${paramName}}`, value?.toString() || '');
            }
            else if (field.startsWith('query.')) {
                // Handle query parameters
                const urlObj = new URL(populatedUrl);
                const paramName = field.split('.')[1];
                urlObj.searchParams.set(paramName, value?.toString() || '');
                populatedUrl = urlObj.toString();
            }
            else if (field.startsWith('body.')) {
                // Handle body fields
                if (!populatedData) {
                    populatedData = {};
                }
                // Convert string data to object if needed
                if (typeof populatedData === 'string') {
                    try {
                        populatedData = JSON.parse(populatedData);
                    }
                    catch (e) {
                        console.error('Error parsing body data:', e);
                        populatedData = {};
                    }
                }
                // Navigate to the correct location in the body object
                const fieldParts = field.split('.').slice(1); // Remove 'body' prefix
                let currentObj = populatedData;
                // Navigate to the nested object where we need to update the value
                for (let i = 0; i < fieldParts.length - 1; i++) {
                    if (!currentObj[fieldParts[i]]) {
                        currentObj[fieldParts[i]] = {};
                    }
                    currentObj = currentObj[fieldParts[i]];
                }
                // Update the specific field
                const lastField = fieldParts[fieldParts.length - 1];
                currentObj[lastField] = value;
                console.log('Updated body data:', {
                    field,
                    value,
                    updatedBody: populatedData
                });
            }
        });
        console.log('Final URL after parameter replacement:', populatedUrl);
        const fetchOptions = {
            method,
            headers: populatedHeaders,
        };
        // Only add body for non-GET requests or if we actually have data
        if (populatedData && method.toUpperCase() !== 'GET') {
            console.log('Preparing request body:', {
                data: populatedData,
                dataType: typeof populatedData
            });
            if (typeof populatedData === 'string') {
                fetchOptions.body = populatedData;
            }
            else {
                fetchOptions.body = JSON.stringify(populatedData);
            }
            if (!populatedHeaders['Content-Type']) {
                fetchOptions.headers['Content-Type'] = 'application/json';
            }
        }
        console.log('Final fetch options:', {
            method: fetchOptions.method,
            headers: fetchOptions.headers,
            hasBody: !!fetchOptions.body,
            bodyLength: fetchOptions.body ? fetchOptions.body.length : 0,
            bodyPreview: fetchOptions.body ? fetchOptions.body.substring(0, 200) + '...' : undefined
        });
        const response = await (0, node_fetch_1.default)(populatedUrl, fetchOptions);
        const responseBody = await response.text();
        const duration = Date.now() - startTime;
        // Extract response headers
        const responseHeaders = {};
        response.headers.forEach((value, key) => {
            responseHeaders[key.toLowerCase()] = value;
        });
        return {
            success: response.ok,
            status: response.status,
            statusText: response.statusText,
            body: responseBody,
            headers: responseHeaders,
            duration,
        };
    }
    catch (error) {
        const duration = Date.now() - startTime;
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            duration,
        };
    }
});
// New IPC handler for executing multiple requests at once
electron_1.ipcMain.handle('api:executeRequests', async (_, configs) => {
    console.log('Starting batch request execution...', { numberOfRequests: configs.length });
    const startTime = Date.now();
    const results = [];
    try {
        // Execute all requests concurrently
        console.log('Preparing to execute requests concurrently...');
        const promises = configs.map(async (config, index) => {
            const requestStartTime = Date.now();
            console.log(`Processing request ${index + 1}/${configs.length}...`);
            try {
                const { method = 'GET', url, headers = {}, data, mappedFields, mongoDocument } = config;
                console.log(`Request ${index + 1} details:`, {
                    method,
                    url,
                    hasMongoDocument: !!mongoDocument,
                    hasMappedFields: Object.keys(mappedFields || {}).length > 0
                });
                // Use the provided MongoDB document directly instead of fetching
                let mongoValues = {};
                if (mongoDocument && Object.keys(mappedFields).length > 0) {
                    console.log(`Request ${index + 1}: Processing MongoDB values...`, {
                        mappedFields,
                        mongoDocument
                    });
                    // Convert mappedFields from array to object if needed
                    const mappedFieldsObj = Array.isArray(mappedFields)
                        ? mappedFields.reduce((acc, field) => {
                            // Keep the full field path as the key
                            acc[field] = field;
                            return acc;
                        }, {})
                        : mappedFields;
                    console.log('Processed mapped fields:', mappedFieldsObj);
                    mongoValues = Object.entries(mappedFieldsObj).reduce((acc, [curlField, fieldConfig]) => {
                        console.log(`Processing field mapping:`, {
                            curlField,
                            fieldConfig,
                            fieldConfigType: typeof fieldConfig
                        });
                        // Handle special values first
                        if (fieldConfig === 'specialValue') {
                            acc[curlField] = crypto_1.default.randomUUID();
                            return acc;
                        }
                        // Handle fixed values
                        if (typeof fieldConfig === 'object' && fieldConfig !== null && 'type' in fieldConfig && fieldConfig.type === 'fixed') {
                            const config = fieldConfig;
                            console.log(`Using fixed value:`, {
                                curlField,
                                fixedValue: config.value
                            });
                            acc[curlField] = config.value;
                            return acc;
                        }
                        // Handle MongoDB fields
                        if (typeof fieldConfig === 'object' && fieldConfig !== null && 'type' in fieldConfig && fieldConfig.type === 'mongodb') {
                            const config = fieldConfig;
                            const targetField = config.targetField;
                            console.log(`Extracting MongoDB field value:`, {
                                curlField,
                                targetField,
                                value: mongoDocument[targetField]
                            });
                            acc[curlField] = mongoDocument[targetField];
                            return acc;
                        }
                        // Extract the field path from the curl field
                        const fieldParts = curlField.split('.');
                        const isHeaderField = fieldParts[0] === 'header';
                        // Get the value from MongoDB using the targetField
                        let value = mongoDocument;
                        const fieldName = fieldParts[fieldParts.length - 1];
                        // Get the specific field value from the MongoDB document
                        value = mongoDocument[fieldName];
                        console.log(`Extracting field value from MongoDB:`, {
                            curlField,
                            fieldName,
                            value,
                            valueType: typeof value,
                            isHeaderField
                        });
                        acc[curlField] = value;
                        return acc;
                    }, {});
                    console.log('Final mongoValues:', mongoValues);
                }
                // Now populate the request with MongoDB values
                let populatedUrl = url;
                let populatedHeaders = { ...headers };
                let populatedData = data;
                // Replace URL parameters
                console.log('Processing URL parameters:', {
                    url: populatedUrl,
                    mongoValues,
                    hasUrlParams: populatedUrl.includes('{$P')
                });
                // First try to match any {$P...} pattern in the URL
                const matches = populatedUrl.match(/\{\$P[^}]+\}/g);
                if (matches) {
                    console.log('Found URL parameter matches:', matches);
                    matches.forEach((match) => {
                        // Extract the placeholder ID from the {$P...} format
                        const placeholderId = match.slice(3, -1); // Remove {$P and }
                        console.log('Processing URL parameter:', { match, placeholderId });
                        // Look for a field that maps to this path parameter
                        const mappedField = Object.entries(mongoValues).find(([field, value]) => {
                            // The field should be a path parameter mapping
                            return field.startsWith('url.pathParams.') &&
                                field.endsWith(placeholderId);
                        });
                        if (mappedField) {
                            const [field, value] = mappedField;
                            console.log('Found path parameter mapping:', {
                                match,
                                placeholderId,
                                field,
                                value
                            });
                            populatedUrl = populatedUrl.replace(match, value.toString());
                        }
                        else {
                            console.log('No path parameter mapping found:', {
                                match,
                                placeholderId,
                                availableFields: Object.keys(mongoValues)
                            });
                            throw new Error(`No mapping found for path parameter ${match}. Available fields: ${Object.keys(mongoValues).join(', ')}`);
                        }
                    });
                }
                // Then handle explicit field mappings
                Object.entries(mongoValues).forEach(([field, value]) => {
                    if (field.startsWith('url.')) {
                        const paramName = field.split('.')[1];
                        populatedUrl = populatedUrl.replace(`{${paramName}}`, value?.toString() || '');
                    }
                    else if (field.startsWith('query.')) {
                        // Handle query parameters
                        const urlObj = new URL(populatedUrl);
                        const paramName = field.split('.')[1];
                        urlObj.searchParams.set(paramName, value?.toString() || '');
                        populatedUrl = urlObj.toString();
                    }
                    else if (field.startsWith('body.')) {
                        // Handle body fields
                        if (!populatedData) {
                            populatedData = {};
                        }
                        // Convert string data to object if needed
                        if (typeof populatedData === 'string') {
                            try {
                                populatedData = JSON.parse(populatedData);
                            }
                            catch (e) {
                                console.error('Error parsing body data:', e);
                                populatedData = {};
                            }
                        }
                        // Navigate to the correct location in the body object
                        const fieldParts = field.split('.').slice(1); // Remove 'body' prefix
                        let currentObj = populatedData;
                        // Navigate to the nested object where we need to update the value
                        for (let i = 0; i < fieldParts.length - 1; i++) {
                            if (!currentObj[fieldParts[i]]) {
                                currentObj[fieldParts[i]] = {};
                            }
                            currentObj = currentObj[fieldParts[i]];
                        }
                        // Update the specific field
                        const lastField = fieldParts[fieldParts.length - 1];
                        currentObj[lastField] = value;
                        console.log('Updated body data:', {
                            field,
                            value,
                            updatedBody: populatedData
                        });
                    }
                });
                console.log('Final URL after parameter replacement:', populatedUrl);
                // Replace header values
                Object.entries(mongoValues).forEach(([field, value]) => {
                    if (field.startsWith('header.')) {
                        const parts = field.split('.');
                        const headerName = parts[1]; // e.g., 'encodedHeader'
                        const fieldPath = parts.slice(2).join('.'); // e.g., 'email'
                        console.log(`Processing header field:`, {
                            field,
                            parts,
                            headerName,
                            fieldPath,
                            value,
                            valueType: typeof value,
                            originalHeaderValue: populatedHeaders[headerName]
                        });
                        const originalValue = populatedHeaders[headerName];
                        const isBase64 = originalValue && /^[A-Za-z0-9+/=]+$/.test(originalValue);
                        console.log(`Header value details:`, {
                            headerName,
                            originalValue,
                            isBase64,
                            value
                        });
                        if (isBase64) {
                            try {
                                const decodedValue = atob(originalValue);
                                console.log('Processing base64 header:', {
                                    field,
                                    fieldPath,
                                    value,
                                    decodedValue
                                });
                                const headerObj = JSON.parse(decodedValue);
                                console.log('Original header object:', headerObj);
                                // Update only the specific field in the object
                                const fieldParts = fieldPath.split('.');
                                let currentObj = headerObj;
                                // Navigate to the nested object where we need to update the value
                                for (let i = 0; i < fieldParts.length - 1; i++) {
                                    if (!currentObj[fieldParts[i]]) {
                                        currentObj[fieldParts[i]] = {};
                                    }
                                    currentObj = currentObj[fieldParts[i]];
                                }
                                // Update the specific field with the value from MongoDB
                                const lastField = fieldParts[fieldParts.length - 1];
                                currentObj[lastField] = value;
                                console.log('Updated header object:', {
                                    fieldPath,
                                    newValue: value,
                                    updatedObject: headerObj
                                });
                                // Encode back to base64
                                const newValue = btoa(JSON.stringify(headerObj));
                                populatedHeaders[headerName] = newValue;
                                console.log('Final header value:', {
                                    headerName,
                                    newValue,
                                    decoded: atob(newValue)
                                });
                            }
                            catch (e) {
                                console.error('Error processing base64 header:', {
                                    error: e,
                                    headerName,
                                    fieldPath,
                                    originalValue,
                                    value
                                });
                                // Fallback to direct value if processing fails
                                populatedHeaders[headerName] = value?.toString() || '';
                            }
                        }
                        else {
                            populatedHeaders[headerName] = value?.toString() || '';
                        }
                    }
                });
                console.log(`Request ${index + 1}: Executing HTTP request...`, {
                    method,
                    url: populatedUrl,
                    headers: populatedHeaders,
                    hasBody: !!populatedData,
                    bodyData: populatedData,
                    bodyType: typeof populatedData
                });
                const fetchOptions = {
                    method,
                    headers: populatedHeaders,
                };
                // Only add body for non-GET requests or if we actually have data
                if (populatedData && method.toUpperCase() !== 'GET') {
                    console.log(`Request ${index + 1}: Preparing body data:`, {
                        originalData: populatedData,
                        dataType: typeof populatedData
                    });
                    if (typeof populatedData === 'string') {
                        fetchOptions.body = populatedData;
                        console.log(`Request ${index + 1}: Using string body:`, populatedData);
                    }
                    else {
                        const stringifiedBody = JSON.stringify(populatedData);
                        fetchOptions.body = stringifiedBody;
                        console.log(`Request ${index + 1}: Using JSON body:`, stringifiedBody);
                    }
                    if (!populatedHeaders['Content-Type']) {
                        fetchOptions.headers['Content-Type'] = 'application/json';
                    }
                }
                else {
                    console.log(`Request ${index + 1}: No body data to send`);
                }
                console.log(`Request ${index + 1}: Final fetch options:`, {
                    method: fetchOptions.method,
                    headers: fetchOptions.headers,
                    hasBody: !!fetchOptions.body,
                    bodyLength: fetchOptions.body ? fetchOptions.body.length : 0
                });
                const response = await (0, node_fetch_1.default)(populatedUrl, fetchOptions);
                const responseBody = await response.text();
                const duration = Date.now() - requestStartTime;
                // Extract response headers
                const responseHeaders = {};
                response.headers.forEach((value, key) => {
                    responseHeaders[key.toLowerCase()] = value;
                });
                console.log(`Request ${index + 1} completed:`, {
                    status: response.status,
                    duration,
                    success: response.ok
                });
                return {
                    success: response.ok,
                    status: response.status,
                    statusText: response.statusText,
                    body: responseBody,
                    headers: responseHeaders,
                    duration,
                };
            }
            catch (error) {
                const duration = Date.now() - requestStartTime;
                console.error(`Request ${index + 1} failed:`, error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    duration,
                };
            }
        });
        // Wait for all requests to complete
        console.log('Waiting for all requests to complete...');
        const requestResults = await Promise.all(promises);
        results.push(...requestResults);
        console.log('All requests completed', {
            totalRequests: results.length,
            successfulRequests: results.filter(r => r.success).length,
            failedRequests: results.filter(r => !r.success).length,
            totalDuration: Date.now() - startTime
        });
    }
    catch (error) {
        console.error('Error executing requests:', error);
    }
    return results;
});
// Helm Chart IPC Handlers
electron_1.ipcMain.handle('helm:select-chart', async () => {
    if (!mainWindow)
        return null;
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Helm Chart Directory'
    });
    if (result.canceled)
        return null;
    return result.filePaths[0];
});
electron_1.ipcMain.handle('helm:read-chart', async (_, chartPath) => {
    try {
        const chartYamlPath = path.join(chartPath, 'Chart.yaml');
        const valuesYamlPath = path.join(chartPath, 'values.yaml');
        // Check if directory exists and has Chart.yaml
        try {
            await fs.promises.access(chartYamlPath);
        }
        catch {
            return { success: false, error: 'Not a valid Helm chart directory (Chart.yaml missing)' };
        }
        const chartYaml = await fs.promises.readFile(chartYamlPath, 'utf8');
        let valuesYaml = '';
        try {
            valuesYaml = await fs.promises.readFile(valuesYamlPath, 'utf8');
        }
        catch (e) {
            console.warn('No values.yaml found');
        }
        return { success: true, chartYaml, valuesYaml };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to read chart' };
    }
});
electron_1.ipcMain.handle('helm:scan-templates', async (_, chartPath) => {
    try {
        const templatesDir = path.join(chartPath, 'templates');
        const files = [];
        // Helper to recursively read files
        async function readDirRecursive(dir) {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await readDirRecursive(fullPath);
                }
                else if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml') || entry.name.endsWith('.tpl'))) {
                    const content = await fs.promises.readFile(fullPath, 'utf8');
                    files.push({
                        name: entry.name,
                        path: path.relative(chartPath, fullPath),
                        content
                    });
                }
            }
        }
        // Read templates directory if it exists
        try {
            await readDirRecursive(templatesDir);
        }
        catch (e) {
            console.warn('No templates directory found');
        }
        // Also check for _helpers.tpl in root if not found in templates
        try {
            const helpersPath = path.join(chartPath, '_helpers.tpl');
            if (fs.existsSync(helpersPath)) {
                const content = await fs.promises.readFile(helpersPath, 'utf8');
                files.push({
                    name: '_helpers.tpl',
                    path: '_helpers.tpl',
                    content
                });
            }
        }
        catch (e) {
            // Ignore
        }
        return { success: true, files };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to scan templates' };
    }
});
electron_1.ipcMain.handle('helm:lint', async (_, chartPath) => {
    try {
        const { stdout, stderr } = await execAsync(`helm lint "${chartPath}"`);
        return { success: true, output: stdout, error: stderr };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Linting failed',
            output: error.stdout || ''
        };
    }
});
electron_1.ipcMain.handle('helm:template', async (_, chartPath) => {
    try {
        const { stdout, stderr } = await execAsync(`helm template "${chartPath}"`);
        return { success: true, output: stdout, error: stderr };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Template generation failed',
            output: error.stdout || ''
        };
    }
});
// Encryption IPC Handlers
electron_1.ipcMain.handle('generateEncryptionKey', async () => {
    try {
        encryptionKey = crypto_1.default.randomBytes(32);
        const keyPath = path.join(electron_1.app.getPath('userData'), 'encryption.key');
        await fs.promises.writeFile(keyPath, encryptionKey);
        return { success: true };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate encryption key'
        };
    }
});
electron_1.ipcMain.handle('encryptSecret', async (_, content) => {
    try {
        if (!encryptionKey) {
            throw new Error('Encryption key not initialized');
        }
        // Generate a random IV
        const iv = crypto_1.default.randomBytes(16);
        // Create cipher
        const cipher = crypto_1.default.createCipheriv('aes-256-cbc', encryptionKey, iv);
        // Encrypt the content
        let encrypted = cipher.update(content, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        // Combine IV and encrypted content
        const result = {
            iv: iv.toString('base64'),
            content: encrypted
        };
        // Format as YAML
        const yamlOutput = `# This is an encrypted secret
# DO NOT EDIT THIS FILE MANUALLY
# Generated: ${new Date().toISOString()}

encrypted: |
  ${JSON.stringify(result)}
`;
        return { success: true, encrypted: yamlOutput };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to encrypt secret'
        };
    }
});
electron_1.ipcMain.handle('decryptSecret', async (_, content) => {
    try {
        if (!encryptionKey) {
            throw new Error('Encryption key not initialized');
        }
        // Parse the YAML content
        const lines = content.split('\n');
        const encryptedLine = lines.find(line => line.trim().startsWith('encrypted:'));
        if (!encryptedLine) {
            throw new Error('Invalid encrypted content format');
        }
        // Extract the encrypted data
        const encryptedData = JSON.parse(encryptedLine.split('|')[1].trim());
        // Create decipher
        const decipher = crypto_1.default.createDecipheriv('aes-256-cbc', encryptionKey, Buffer.from(encryptedData.iv, 'base64'));
        // Decrypt the content
        let decrypted = decipher.update(encryptedData.content, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return { success: true, decrypted };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to decrypt secret'
        };
    }
});
// Keytab IPC Handlers
electron_1.ipcMain.handle('keytab:process', async (_, content) => {
    try {
        console.log('Backend: Received keytab content, size:', content.byteLength);
        // Create a temporary file to store the keytab content
        const tempFile = path.join(electron_1.app.getPath('temp'), `keytab-${Date.now()}`);
        const buffer = Buffer.from(content);
        console.log('Backend: Created buffer, size:', buffer.length);
        await fs.promises.writeFile(tempFile, buffer);
        console.log('Backend: Wrote temp file:', tempFile);
        // Use ktutil to read the keytab contents (try system ktutil first, then homebrew)
        let ktutilPath = '/usr/sbin/ktutil';
        try {
            await fs.promises.access(ktutilPath);
        }
        catch {
            ktutilPath = '/opt/homebrew/Cellar/krb5/1.21.3/bin/ktutil';
        }
        const { stdout, stderr } = await execAsync(`${ktutilPath} -k ${tempFile} list --timestamp`);
        console.log('Backend: ktutil list output:', stdout);
        console.log('Backend: ktutil list stderr:', stderr);
        // Parse the ktutil list output
        // Format: "Vno  Type                     Principal                     Date        Aliases"
        // Example: "  1  aes256-cts-hmac-sha1-96  test/example.com@EXAMPLE.COM  2025-08-29  "
        const entries = stdout
            .split('\n')
            .filter(line => line.includes('@') && line.trim() && !line.includes('Principal')) // Skip header line
            .map(line => {
            const trimmed = line.trim();
            // Split by multiple spaces to separate columns
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 4) {
                const kvno = parseInt(parts[0]);
                const encryptionType = parts[1];
                const principal = parts[2];
                const date = parts[3] || new Date().toISOString().split('T')[0];
                return {
                    kvno,
                    principal,
                    timestamp: new Date(date).toISOString(),
                    encryptionType
                };
            }
            return null;
        })
            .filter(Boolean);
        console.log('Backend: Parsed entries:', entries);
        // Clean up the temporary file
        await fs.promises.unlink(tempFile);
        return {
            success: true,
            entries
        };
    }
    catch (error) {
        console.error('Keytab processing error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to process keytab file'
        };
    }
});
// IPC handler: create keytab
electron_1.ipcMain.handle('keytab:create', async (_, { principal, password, encryptionType, kvno, outputPath }) => {
    try {
        console.log('Creating keytab with:', { principal, password: '[REDACTED]', encryptionType, kvno, outputPath });
        // Map our encryption type names to ktutil format (based on testing what actually works)
        const encTypeMap = {
            'aes256-cts-hmac-sha1-96': 'aes256-cts-hmac-sha1-96', // Works as-is
            'aes128-cts-hmac-sha1-96': 'aes128-cts-hmac-sha1-96', // Works as-is
            'des3-cbc-sha1': 'des3-cbc-sha1', // Works as-is
            // Note: rc4-hmac and arcfour-hmac are NOT supported by this ktutil version
        };
        const ktutilEncType = encTypeMap[encryptionType];
        if (!ktutilEncType) {
            throw new Error(`Unsupported encryption type: ${encryptionType}`);
        }
        // Show save dialog if no output path provided
        let targetPath = outputPath;
        if (!targetPath) {
            const { filePath, canceled } = await electron_1.dialog.showSaveDialog({
                title: 'Save Keytab File',
                defaultPath: `${principal.replace(/[@/]/g, '_')}.keytab`,
                filters: [{ name: 'Keytab Files', extensions: ['keytab'] }]
            });
            if (canceled || !filePath) {
                return { success: false, error: 'Save canceled' };
            }
            targetPath = filePath;
        }
        console.log('Backend: Creating keytab for principal:', principal);
        console.log('Backend: Using encryption type:', ktutilEncType);
        console.log('Backend: Target path:', targetPath);
        // Find ktutil
        let ktutilPath = '/usr/sbin/ktutil';
        try {
            await fs.promises.access(ktutilPath);
            console.log('Backend: Using system ktutil at:', ktutilPath);
        }
        catch {
            ktutilPath = '/opt/homebrew/Cellar/krb5/1.21.3/bin/ktutil';
            console.log('Backend: Using homebrew ktutil at:', ktutilPath);
        }
        // Use the correct ktutil syntax for this version
        const createKeytabCommand = `${ktutilPath} -k "${targetPath}" add -p "${principal}" -V ${kvno} -e ${ktutilEncType} -w "${password}"`;
        console.log('Backend: Executing keytab creation command');
        const { stdout, stderr } = await execAsync(createKeytabCommand);
        console.log('Backend: ktutil stdout:', stdout);
        console.log('Backend: ktutil stderr:', stderr);
        // Check if keytab file was created and has content
        const stats = await fs.promises.stat(targetPath).catch(() => null);
        if (stats && stats.size > 0) {
            console.log('Backend: Keytab file created successfully, size:', stats.size);
            // Verify the keytab can be read
            try {
                const { stdout: verifyOut } = await execAsync(`${ktutilPath} -k ${targetPath} list --timestamp`);
                console.log('Backend: Created keytab verification:', verifyOut);
            }
            catch (verifyError) {
                console.log('Backend: Keytab verification failed:', verifyError);
            }
            return { success: true, filePath: targetPath };
        }
        else {
            throw new Error('Keytab file was not created or is empty');
        }
    }
    catch (error) {
        console.error('Keytab creation error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create keytab'
        };
    }
});
// Kafka IPC Handlers
electron_1.ipcMain.handle('kafka:connect', async (_, config) => {
    try {
        // Prepare Kafka client configuration
        const kafkaConfig = {
            clientId: config.clientId,
            brokers: config.brokers,
        };
        // Add SSL configuration if needed
        if (config.securityProtocol === 'SSL' || config.securityProtocol === 'SASL_SSL') {
            kafkaConfig.ssl = {
                rejectUnauthorized: true,
            };
            if (config.ssl?.caLocation) {
                kafkaConfig.ssl.ca = [await fs.promises.readFile(config.ssl.caLocation)];
            }
            if (config.ssl?.certLocation && config.ssl?.keyLocation) {
                kafkaConfig.ssl.cert = await fs.promises.readFile(config.ssl.certLocation);
                kafkaConfig.ssl.key = await fs.promises.readFile(config.ssl.keyLocation);
                if (config.ssl.keyPassword) {
                    kafkaConfig.ssl.passphrase = config.ssl.keyPassword;
                }
            }
        }
        // Add SASL configuration if needed
        if (config.securityProtocol === 'SASL_PLAINTEXT' || config.securityProtocol === 'SASL_SSL') {
            if (config.saslMechanism === 'GSSAPI' && config.kerberos) {
                // Set Kerberos environment variables if krb5.conf is provided
                if (config.kerberos.krb5ConfigLocation) {
                    process.env.KRB5_CONFIG = config.kerberos.krb5ConfigLocation;
                }
                // Set Kerberos keytab if provided
                if (config.kerberos.keytabLocation) {
                    process.env.KRB5_CLIENT_KTNAME = config.kerberos.keytabLocation;
                }
                kafkaConfig.sasl = {
                    mechanism: 'GSSAPI',
                    authenticationProvider: {
                        serviceName: config.kerberos.serviceName || 'kafka',
                        principal: config.kerberos.principal,
                    },
                };
            }
            else if (config.saslMechanism && config.sasl) {
                kafkaConfig.sasl = {
                    mechanism: config.saslMechanism,
                    username: config.sasl.username,
                    password: config.sasl.password,
                };
            }
        }
        // Create Kafka client with the configuration
        kafkaClient = new kafkajs_1.Kafka(kafkaConfig);
        // Test the connection by getting metadata
        const admin = kafkaClient.admin();
        await admin.listTopics();
        await admin.disconnect();
        return { success: true };
    }
    catch (error) {
        console.error('Kafka connection error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to connect to Kafka'
        };
    }
});
electron_1.ipcMain.handle('kafka:listTopics', async () => {
    try {
        if (!kafkaClient)
            throw new Error('Not connected to Kafka');
        const admin = kafkaClient.admin();
        const topics = await admin.listTopics();
        await admin.disconnect();
        return { success: true, topics };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list topics'
        };
    }
});
electron_1.ipcMain.handle('kafka:createTopic', async (_, { topic, partitions = 1, replicationFactor = 1 }) => {
    try {
        if (!kafkaClient)
            throw new Error('Not connected to Kafka');
        const admin = kafkaClient.admin();
        await admin.createTopics({
            topics: [{
                    topic,
                    numPartitions: partitions,
                    replicationFactor: replicationFactor,
                }],
        });
        await admin.disconnect();
        return { success: true };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create topic'
        };
    }
});
electron_1.ipcMain.handle('kafka:produce', async (_, { topic, messages, acks = -1 }) => {
    try {
        if (!kafkaClient)
            throw new Error('Not connected to Kafka');
        // Create producer if it doesn't exist
        if (!kafkaProducer) {
            kafkaProducer = kafkaClient.producer();
            await kafkaProducer.connect();
        }
        // Send messages
        const result = await kafkaProducer.send({
            topic,
            messages: messages.map((msg) => ({
                key: msg.key ? Buffer.from(msg.key) : undefined,
                value: msg.value ? Buffer.from(msg.value) : undefined,
                headers: msg.headers,
            })),
            acks,
        });
        return {
            success: true,
            result: {
                topicName: result[0].topicName,
                partition: result[0].partition,
                baseOffset: result[0].baseOffset,
                logAppendTime: result[0].logAppendTime,
            }
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to produce message'
        };
    }
});
electron_1.ipcMain.handle('kafka:consume', async (_, { topic, groupId, fromBeginning = false, autoCommit = true, maxMessages = 100, }) => {
    try {
        if (!kafkaClient)
            throw new Error('Not connected to Kafka');
        // Create consumer if it doesn't exist
        if (!kafkaConsumer) {
            kafkaConsumer = kafkaClient.consumer({ groupId });
            await kafkaConsumer.connect();
        }
        // Subscribe to topic
        await kafkaConsumer.subscribe({
            topic,
            fromBeginning
        });
        // Start consuming
        const messages = [];
        let messageCount = 0;
        await kafkaConsumer.run({
            autoCommit,
            eachMessage: async ({ topic, partition, message }) => {
                if (messageCount >= maxMessages) {
                    await kafkaConsumer?.disconnect();
                    return;
                }
                messages.push({
                    topic,
                    partition,
                    offset: message.offset,
                    key: message.key,
                    value: message.value,
                    headers: message.headers,
                    timestamp: message.timestamp,
                });
                messageCount++;
                if (messageCount >= maxMessages) {
                    await kafkaConsumer?.disconnect();
                }
            },
        });
        // Store consumer for later cleanup
        const consumerId = crypto_1.default.randomUUID();
        activeConsumers.set(consumerId, kafkaConsumer);
        return {
            success: true,
            consumerId,
            messages: messages.map(msg => ({
                topic: msg.topic,
                partition: msg.partition,
                offset: msg.offset,
                key: msg.key?.toString(),
                value: msg.value?.toString(),
                headers: msg.headers,
                timestamp: msg.timestamp,
            }))
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to consume messages'
        };
    }
});
electron_1.ipcMain.handle('kafka:stopConsumer', async (_, consumerId) => {
    try {
        const consumer = activeConsumers.get(consumerId);
        if (consumer) {
            await consumer.disconnect();
            activeConsumers.delete(consumerId);
        }
        return { success: true };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to stop consumer'
        };
    }
});
electron_1.ipcMain.handle('kafka:disconnect', async () => {
    try {
        // Disconnect producer
        if (kafkaProducer) {
            await kafkaProducer.disconnect();
            kafkaProducer = null;
        }
        // Disconnect all consumers
        for (const [_, consumer] of activeConsumers) {
            await consumer.disconnect();
        }
        activeConsumers.clear();
        // Clear client
        kafkaClient = null;
        return { success: true };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to disconnect from Kafka'
        };
    }
});
// App lifecycle handlers
electron_1.app.whenReady().then(async () => {
    await loadEncryptionKey();
    createWindow();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
electron_1.app.on('quit', async () => {
    // Clean up MongoDB
    for (const [_, cursor] of activeCursors) {
        await cursor.close();
    }
    activeCursors.clear();
    if (mongoClient) {
        await mongoClient.close();
    }
    // Clean up Kafka
    if (kafkaProducer) {
        await kafkaProducer.disconnect();
    }
    for (const [_, consumer] of activeConsumers) {
        await consumer.disconnect();
    }
    activeConsumers.clear();
});
// Error handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});
// Helper function to get MongoDB client
async function getMongoClient(connectionString) {
    const client = new mongodb_1.MongoClient(connectionString);
    await client.connect();
    return client;
}
// New IPC handler for 'file:read'
electron_1.ipcMain.handle('file:read', async (_, filePath) => {
    try {
        const content = await fs.promises.readFile(filePath);
        return { success: true, content: Array.from(content) };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to read file' };
    }
});
// Add saveFile handler
electron_1.ipcMain.handle('saveFile', async (_, defaultPath, content) => {
    try {
        // Show save dialog
        const { filePath, canceled } = await electron_1.dialog.showSaveDialog({
            title: 'Save File',
            defaultPath: defaultPath,
            filters: [{ name: 'Java Files', extensions: ['java'] }, { name: 'All Files', extensions: ['*'] }]
        });
        if (canceled || !filePath) {
            return { success: false, canceled: true };
        }
        // Create directory if it doesn't exist
        const dirPath = path.dirname(filePath);
        await fs.promises.mkdir(dirPath, { recursive: true });
        // Write the file
        await fs.promises.writeFile(filePath, content, 'utf8');
        return { success: true, filePath };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to save file'
        };
    }
});
// Add saveFilesToDirectory handler
electron_1.ipcMain.handle('saveFilesToDirectory', async (_, files) => {
    try {
        // Show directory selection dialog
        const { filePaths, canceled } = await electron_1.dialog.showOpenDialog({
            title: 'Select Directory to Save Files',
            properties: ['openDirectory', 'createDirectory']
        });
        if (canceled || !filePaths || filePaths.length === 0) {
            return { success: false, canceled: true };
        }
        const directoryPath = filePaths[0];
        const errors = [];
        let successCount = 0;
        // Save each file
        for (const file of files) {
            try {
                const filePath = path.join(directoryPath, file.fileName);
                // Create subdirectories if needed
                const fileDir = path.dirname(filePath);
                await fs.promises.mkdir(fileDir, { recursive: true });
                // Write the file
                await fs.promises.writeFile(filePath, file.content, 'utf8');
                successCount++;
            }
            catch (error) {
                errors.push({
                    fileName: file.fileName,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        if (errors.length > 0 && successCount === 0) {
            return {
                success: false,
                error: 'Failed to save all files',
                errors
            };
        }
        return {
            success: true,
            directoryPath,
            count: successCount,
            errors: errors.length > 0 ? errors : undefined
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to save files to directory'
        };
    }
});
// Port Killer IPC Handler
electron_1.ipcMain.handle('port:kill', async (_, port) => {
    try {
        const platform = process.platform;
        let pids = [];
        if (platform === 'win32') {
            // Prefer PowerShell (more reliable), then fallback to netstat
            try {
                const { stdout } = await execAsync(`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object -ExpandProperty OwningProcess"`);
                pids = stdout
                    .split(/\r?\n/)
                    .map(s => parseInt(s.trim(), 10))
                    .filter(n => Number.isFinite(n));
            }
            catch {
                const { stdout } = await execAsync(`cmd /c netstat -ano | findstr :${port}`);
                const lines = stdout.split(/\r?\n/).filter(l => l.includes(`:${port}`));
                const pidSet = new Set();
                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    const maybePid = parseInt(parts[parts.length - 1], 10);
                    const state = parts[3] || '';
                    // Only kill LISTENING (or if state missing, still include PID)
                    if (Number.isFinite(maybePid) && (state.toUpperCase() === 'LISTENING' || !state)) {
                        pidSet.add(maybePid);
                    }
                }
                pids = Array.from(pidSet);
            }
            if (pids.length === 0) {
                return { success: false, error: `No process found using port ${port}` };
            }
            for (const pid of pids) {
                await execAsync(`taskkill /PID ${pid} /F`);
            }
        }
        else {
            // macOS/Linux path using lsof (fallback to fuser if needed)
            let stdout = '';
            try {
                const res = await execAsync(`lsof -i :${port} -t`);
                stdout = res.stdout;
            }
            catch {
                // Try fuser as a fallback
                const res = await execAsync(`fuser -n tcp ${port}`);
                stdout = res.stdout;
            }
            const raw = stdout.trim();
            if (!raw) {
                return { success: false, error: `No process found using port ${port}` };
            }
            pids = raw
                .split(/\s+/)
                .map(s => parseInt(s.trim(), 10))
                .filter(n => Number.isFinite(n));
            for (const pid of pids) {
                await execAsync(`kill -9 ${pid}`);
            }
        }
        return {
            success: true,
            message: `Successfully killed process(es) on port ${port}`,
            pids
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to kill process on port'
        };
    }
});
// Shell External Browser Handler
electron_1.ipcMain.handle('shell:openExternal', async (_, url) => {
    try {
        console.log('Opening external URL:', url);
        await electron_1.shell.openExternal(url);
        console.log('Successfully opened external URL in system browser');
        return { success: true };
    }
    catch (error) {
        console.error('Failed to open external URL:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to open external URL'
        };
    }
});
//# sourceMappingURL=main.js.map