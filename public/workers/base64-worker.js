// Base64 Web Worker for handling large files efficiently
// Processes files in chunks to prevent UI blocking

self.onmessage = function(e) {
  try {
    const { type, data } = e.data;
    
    switch (type) {
      case 'ENCODE_CHUNKS':
        encodeInChunks(data);
        break;
      case 'DECODE_CHUNKS':
        decodeInChunks(data);
        break;
      case 'DETECT_FILE_TYPE':
        detectFileType(data);
        break;
      case 'TEST':
        self.postMessage({
          type: 'TEST_RESPONSE',
          data: { 
            messageId: data.messageId,
            message: 'Worker is working!'
          }
        });
        break;
      default:
        // Unknown message type
        break;
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      data: { error: 'Worker message handling failed: ' + error.message }
    });
  }
};

// Encode file to Base64 in chunks
function encodeInChunks({ file, chunkSize = 256 * 1024 }) { // Smaller 256KB chunks
  const reader = new FileReader();
  let offset = 0;
  let base64Result = '';
  const totalSize = file.size;
  
  reader.onload = function(e) {
    try {
      const chunk = new Uint8Array(e.target.result);
      const chunkBase64 = btoa(String.fromCharCode.apply(null, chunk));
      base64Result += chunkBase64;
      
      // Calculate actual progress based on bytes read
      const actualBytesRead = Math.min(offset + chunk.length, totalSize);
      const progress = Math.min((actualBytesRead / totalSize) * 100, 100);
      
      // Send progress update
      self.postMessage({
        type: 'PROGRESS',
        data: {
          progress: progress,
          message: `Encoding... ${Math.round(progress)}% (${Math.round(actualBytesRead / 1024 / 1024 * 10) / 10}MB / ${Math.round(totalSize / 1024 / 1024 * 10) / 10}MB)`
        }
      });
      
      offset += chunk.length;
      
      if (offset < totalSize) {
        // Read next chunk with small delay for UI updates
        setTimeout(() => readNextChunk(), 10);
      } else {
        // Encoding complete
        self.postMessage({
          type: 'ENCODE_COMPLETE',
          data: {
            result: base64Result,
            fileName: file.name,
            fileType: file.type,
            fileSize: totalSize
          }
        });
      }
    } catch (error) {
      self.postMessage({
        type: 'ERROR',
        data: { error: 'Error processing chunk: ' + error.message }
      });
    }
  };
  
  reader.onerror = function(error) {
    self.postMessage({
      type: 'ERROR',
      data: { error: 'Failed to read file chunk: ' + (error.message || 'Unknown error') }
    });
  };
  
  function readNextChunk() {
    const slice = file.slice(offset, offset + chunkSize);
    reader.readAsArrayBuffer(slice);
  }
  
  // Send initial progress
  self.postMessage({
    type: 'PROGRESS',
    data: {
      progress: 0,
      message: `Starting encode... (${Math.round(totalSize / 1024 / 1024 * 10) / 10}MB)`
    }
  });
  
  // Start reading with small delay
  setTimeout(() => readNextChunk(), 50);
}

// Decode Base64 in chunks
function decodeInChunks({ base64Data, chunkSize = 64 * 1024 }) { // Much smaller 64KB chunks for Base64
  try {
    // Clean the Base64 data
    let cleanBase64 = base64Data.trim();
    
    // Remove data URL prefix if present
    if (cleanBase64.startsWith('data:')) {
      const commaIndex = cleanBase64.indexOf(',');
      if (commaIndex !== -1) {
        cleanBase64 = cleanBase64.substring(commaIndex + 1);
      }
    }
    
    // Remove whitespace
    cleanBase64 = cleanBase64.replace(/\s/g, '');
    
    // Validate Base64 format
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(cleanBase64)) {
      throw new Error('Invalid Base64 format');
    }
    
    const totalLength = cleanBase64.length;
    const estimatedSizeMB = Math.round((totalLength * 3 / 4) / 1024 / 1024 * 10) / 10;
    let offset = 0;
    let binaryResult = '';
    let processedChunks = 0;
    
    // Process in smaller chunks with async processing
    function processNextChunk() {
      const startTime = Date.now();
      let chunkCount = 0;
      
      // Process multiple small chunks in one batch (but not too many)
      while (offset < totalLength && chunkCount < 10 && (Date.now() - startTime) < 50) {
        const chunkEnd = Math.min(offset + chunkSize, totalLength);
        const chunk = cleanBase64.substring(offset, chunkEnd);
        
        try {
          const decodedChunk = atob(chunk);
          binaryResult += decodedChunk;
        } catch (err) {
          // If chunk decoding fails, try smaller chunks
          if (chunkSize > 1024) {
            // Retry with smaller chunks
            decodeInChunks({ base64Data, chunkSize: chunkSize / 2 });
            return;
          } else {
            throw new Error('Base64 decoding failed');
          }
        }
        
        offset = chunkEnd;
        chunkCount++;
        processedChunks++;
      }
      
      // Send progress update
      const progress = (offset / totalLength) * 100;
      const processedMB = Math.round((offset * 3 / 4) / 1024 / 1024 * 10) / 10;
      
      self.postMessage({
        type: 'PROGRESS',
        data: {
          progress: progress,
          message: `Decoding... ${Math.round(progress)}% (${processedMB}MB / ${estimatedSizeMB}MB)`
        }
      });
      
      if (offset < totalLength) {
        // Continue processing with a small delay
        setTimeout(processNextChunk, 20);
      } else {
        // Decoding complete
        finalizeDecode();
      }
    }
    
    function finalizeDecode() {
      try {
        // Try to detect if it's text or binary
        let result = binaryResult;
        let fileType = 'binary';
        
        // Check if it's valid UTF-8 text
        try {
          const textResult = decodeURIComponent(escape(binaryResult));
          // If we can decode it and it has mostly printable characters, treat as text
          const printableChars = textResult.split('').filter(char => {
            const code = char.charCodeAt(0);
            return (code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13;
          }).length;
          
          if (printableChars / textResult.length > 0.8) {
            result = textResult;
            fileType = 'text';
            
            // Try to detect JSON or XML
            const trimmed = textResult.trim();
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
                (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
              try {
                JSON.parse(trimmed);
                fileType = 'json';
              } catch {}
            } else if (trimmed.startsWith('<') && trimmed.includes('>')) {
              fileType = 'xml';
            }
          }
        } catch {}
        
        self.postMessage({
          type: 'DECODE_COMPLETE',
          data: {
            result: result,
            fileType: fileType,
            originalSize: binaryResult.length
          }
        });
      } catch (error) {
        self.postMessage({
          type: 'ERROR',
          data: { error: 'Error finalizing decode: ' + error.message }
        });
      }
    }
    
    // Send initial progress
    self.postMessage({
      type: 'PROGRESS',
      data: {
        progress: 0,
        message: `Starting decode... (${estimatedSizeMB}MB estimated)`
      }
    });
    
    // Start processing
    processNextChunk();
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      data: { error: 'Decode initialization failed: ' + error.message }
    });
  }
}

function detectFileTypeFromBinary(base64String) {
  try {
    const cleanBase64 = base64String.replace(/^data:[^;]+;base64,/, '').trim();
    if (cleanBase64.length < 4) return 'unknown';
    
    const sampleLength = Math.min(cleanBase64.length, 60);
    const binaryString = atob(cleanBase64.substring(0, sampleLength));
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Check file signatures (magic numbers)
    if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'jpeg';
    if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'png';
    if (bytes.length >= 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'gif';
    if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf';
    if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4B) return 'zip';
    
    return 'binary';
  } catch {
    return 'unknown';
  }
}

function detectFileType({ base64String }) {
  const fileType = detectFileTypeFromBinary(base64String);
  self.postMessage({
    type: 'FILE_TYPE_DETECTED',
    data: { fileType }
  });
} 