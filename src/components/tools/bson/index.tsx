import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import MonacoEditor from '../../common/editor/MonacoEditor';
import { useTheme } from '../../../hooks/useTheme';
import {
  ArrowRightIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  DocumentTextIcon,
  EyeIcon,
  ClipboardDocumentIcon,
  BookOpenIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

interface BSONToolProps {
  editorHeight?: string;
}

interface BSONTypeInfo {
  type: string;
  description: string;
  size?: number;
  icon: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  info: string[];
}

interface BSONAnalysis {
  documentSize: number;
  fieldCount: number;
  types: Record<string, BSONTypeInfo>;
  depth: number;
}

interface BSONGrade {
  overall: 'A' | 'B' | 'C' | 'D' | 'F';
  categories: {
    performance: { grade: 'A' | 'B' | 'C' | 'D' | 'F'; score: number; };
    network: { grade: 'A' | 'B' | 'C' | 'D' | 'F'; score: number; };
    memory: { grade: 'A' | 'B' | 'C' | 'D' | 'F'; score: number; };
    structure: { grade: 'A' | 'B' | 'C' | 'D' | 'F'; score: number; };
  };
  recommendations: string[];
  warnings: string[];
  insights: string[];
}

interface BSONTemplate {
  name: string;
  description: string;
  category: string;
  content: string;
}

// Sample BSON Templates
const BSON_TEMPLATES: BSONTemplate[] = [
  {
    name: "User Document",
    description: "A typical user document with various BSON types",
    category: "Common Schemas",
    content: `{
  "_id": {"$oid": "507f1f77bcf86cd799439011"},
  "username": "john_doe",
  "email": "john@example.com",
  "age": {"$numberInt": "30"},
  "createdAt": {"$date": "2023-01-01T00:00:00.000Z"},
  "lastLogin": {"$date": "2024-01-15T10:30:00.000Z"},
  "isActive": true,
  "profile": {
    "firstName": "John",
    "lastName": "Doe",
    "bio": "Software developer with 5+ years experience",
    "profilePicture": {
      "$binary": {
        "base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "subType": "00"
      }
    }
  },
  "preferences": {
    "theme": "dark",
    "notifications": {
      "email": true,
      "push": false
    }
  },
  "tags": ["developer", "mongodb", "javascript"],
  "metadata": {
    "version": {"$numberLong": "1"},
    "lastModified": {"$timestamp": {"t": 1640995200, "i": 1}},
    "source": "web_registration"
  }
}`
  },
  {
    name: "E-commerce Order",
    description: "Complete order document with products and pricing",
    category: "E-commerce",
    content: `{
  "_id": {"$oid": "65a1b2c3d4e5f6789abcdef0"},
  "orderNumber": "ORD-2024-001",
  "customerId": {"$oid": "507f1f77bcf86cd799439011"},
  "orderDate": {"$date": "2024-01-15T14:30:00.000Z"},
  "status": "processing",
  "items": [
    {
      "productId": {"$oid": "65a1b2c3d4e5f6789abcdef1"},
      "name": "Wireless Headphones",
      "sku": "WH-001",
      "quantity": {"$numberInt": "2"},
      "unitPrice": {"$numberDouble": "99.99"},
      "totalPrice": {"$numberDouble": "199.98"}
    },
    {
      "productId": {"$oid": "65a1b2c3d4e5f6789abcdef2"},
      "name": "USB Cable",
      "sku": "USB-C-001",
      "quantity": {"$numberInt": "1"},
      "unitPrice": {"$numberDouble": "12.99"},
      "totalPrice": {"$numberDouble": "12.99"}
    }
  ],
  "shipping": {
    "address": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "USA"
    },
    "method": "standard",
    "cost": {"$numberDouble": "9.99"},
    "estimatedDelivery": {"$date": "2024-01-20T00:00:00.000Z"}
  },
  "payment": {
    "method": "credit_card",
    "transactionId": "txn_1234567890",
    "amount": {"$numberDouble": "222.96"},
    "currency": "USD",
    "processedAt": {"$date": "2024-01-15T14:32:15.000Z"}
  },
  "totals": {
    "subtotal": {"$numberDouble": "212.97"},
    "shipping": {"$numberDouble": "9.99"},
    "tax": {"$numberDouble": "0.00"},
    "total": {"$numberDouble": "222.96"}
  }
}`
  },
  {
    name: "IoT Sensor Data",
    description: "Time-series data from IoT sensors",
    category: "IoT & Analytics",
    content: `{
  "_id": {"$oid": "65a1b2c3d4e5f6789abcdef3"},
  "deviceId": "sensor_temp_001",
  "location": {
    "building": "Building A",
    "floor": {"$numberInt": "3"},
    "room": "Conference Room 301",
    "coordinates": {
      "lat": {"$numberDouble": "40.7128"},
      "lng": {"$numberDouble": "-74.0060"}
    }
  },
  "timestamp": {"$date": "2024-01-15T15:45:30.123Z"},
  "readings": {
    "temperature": {
      "value": {"$numberDouble": "22.5"},
      "unit": "celsius",
      "accuracy": {"$numberDouble": "0.1"}
    },
    "humidity": {
      "value": {"$numberDouble": "45.2"},
      "unit": "percent",
      "accuracy": {"$numberDouble": "2.0"}
    },
    "pressure": {
      "value": {"$numberDouble": "1013.25"},
      "unit": "hPa",
      "accuracy": {"$numberDouble": "0.1"}
    }
  },
  "deviceInfo": {
    "model": "TempSense Pro 2000",
    "firmware": "v2.1.3",
    "batteryLevel": {"$numberInt": "87"},
    "signalStrength": {"$numberInt": "-45"},
    "lastCalibration": {"$date": "2024-01-01T09:00:00.000Z"}
  },
  "metadata": {
    "collectionInterval": {"$numberLong": "300000"},
    "dataFormat": "json",
    "compressed": false,
    "checksum": {"$binary": {"base64": "aGVsbG8gd29ybGQ=", "subType": "00"}}
  },
  "alerts": [
    {
      "type": "maintenance_due",
      "priority": "low",
      "message": "Device calibration recommended",
      "triggeredAt": {"$date": "2024-01-15T15:45:30.123Z"}
    }
  ]
}`
  },
  {
    name: "Log Entry",
    description: "Application log entry with error details",
    category: "Logging & Monitoring",
    content: `{
  "_id": {"$oid": "65a1b2c3d4e5f6789abcdef4"},
  "timestamp": {"$date": "2024-01-15T16:20:45.789Z"},
  "level": "ERROR",
  "service": "user-authentication",
  "version": "v1.2.3",
  "traceId": "trace-123-abc-456",
  "spanId": "span-789-def-012",
  "message": "Failed to authenticate user: Invalid token",
  "error": {
    "type": "AuthenticationError",
    "code": "INVALID_TOKEN",
    "details": {
      "tokenHash": "sha256:abcd1234...",
      "expiresAt": {"$date": "2024-01-15T15:00:00.000Z"},
      "issuedAt": {"$date": "2024-01-15T14:00:00.000Z"}
    },
    "stackTrace": "AuthenticationError: Invalid token\\n    at TokenValidator.validate (auth.js:45)\\n    at UserService.authenticate (user.js:120)"
  },
  "context": {
    "userId": {"$oid": "507f1f77bcf86cd799439011"},
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "ipAddress": "192.168.1.100",
    "endpoint": "/api/auth/login",
    "method": "POST",
    "requestId": "req-xyz-789",
    "sessionId": "sess-abc-123"
  },
  "performance": {
    "duration": {"$numberLong": "1250"},
    "memoryUsage": {"$numberLong": "45678901"},
    "cpuUsage": {"$numberDouble": "12.5"}
  },
  "tags": ["authentication", "error", "security"],
  "environment": "production",
  "region": "us-east-1"
}`
  },
  {
    name: "MongoDB Aggregation Result",
    description: "Complex aggregation pipeline result",
    category: "MongoDB Operations",
    content: `{
  "_id": {
    "year": {"$numberInt": "2024"},
    "month": {"$numberInt": "1"},
    "category": "electronics"
  },
  "totalSales": {"$numberDouble": "125430.50"},
  "totalOrders": {"$numberLong": "342"},
  "averageOrderValue": {"$numberDouble": "366.74"},
  "topProducts": [
    {
      "productId": {"$oid": "65a1b2c3d4e5f6789abcdef1"},
      "name": "Smartphone Pro Max",
      "sales": {"$numberDouble": "45230.00"},
      "quantity": {"$numberLong": "45"},
      "averageRating": {"$numberDouble": "4.7"}
    },
    {
      "productId": {"$oid": "65a1b2c3d4e5f6789abcdef2"},
      "name": "Wireless Earbuds",
      "sales": {"$numberDouble": "23400.00"},
      "quantity": {"$numberLong": "156"},
      "averageRating": {"$numberDouble": "4.5"}
    }
  ],
  "customerSegments": {
    "new": {
      "count": {"$numberLong": "89"},
      "totalSpent": {"$numberDouble": "23450.00"}
    },
    "returning": {
      "count": {"$numberLong": "253"},
      "totalSpent": {"$numberDouble": "101980.50"}
    }
  },
  "timeRange": {
    "start": {"$date": "2024-01-01T00:00:00.000Z"},
    "end": {"$date": "2024-01-31T23:59:59.999Z"}
  },
  "generatedAt": {"$timestamp": {"t": 1705689600, "i": 1}},
  "metadata": {
    "pipeline": [
      {"$match": {"category": "electronics", "orderDate": {"$gte": {"$date": "2024-01-01T00:00:00.000Z"}}}},
      {"$group": {"_id": {"year": {"$year": "$orderDate"}, "month": {"$month": "$orderDate"}, "category": "$category"}}},
      {"$sort": {"totalSales": {"$numberInt": "-1"}}}
    ],
    "executionStats": {
      "totalDocsExamined": {"$numberLong": "15430"},
      "totalDocsReturned": {"$numberLong": "1"},
      "executionTimeMillis": {"$numberLong": "234"},
      "indexesUsed": ["category_1_orderDate_1", "orderDate_1"]
    }
  }
}`
  },
  {
    name: "GeoJSON with BSON",
    description: "Location data with GeoJSON and BSON types",
    category: "Geospatial",
    content: `{
  "_id": {"$oid": "65a1b2c3d4e5f6789abcdef5"},
  "name": "Central Park",
  "type": "park",
  "location": {
    "type": "Polygon",
    "coordinates": [[
      [{"$numberDouble": "-73.9580"}, {"$numberDouble": "40.8021"}],
      [{"$numberDouble": "-73.9491"}, {"$numberDouble": "40.7677"}],
      [{"$numberDouble": "-73.9734"}, {"$numberDouble": "40.7645"}],
      [{"$numberDouble": "-73.9815"}, {"$numberDouble": "40.7989"}],
      [{"$numberDouble": "-73.9580"}, {"$numberDouble": "40.8021"}]
    ]]
  },
  "area": {
    "value": {"$numberDouble": "341.15"},
    "unit": "hectares"
  },
  "facilities": [
    {
      "name": "Bethesda Fountain",
      "type": "landmark",
      "coordinates": {
        "type": "Point",
        "coordinates": [{"$numberDouble": "-73.9712"}, {"$numberDouble": "40.7739"}]
      }
    },
    {
      "name": "Sheep Meadow",
      "type": "field",
      "coordinates": {
        "type": "Point", 
        "coordinates": [{"$numberDouble": "-73.9759"}, {"$numberDouble": "40.7751"}]
      }
    }
  ],
  "visitHistory": [
    {
      "date": {"$date": "2024-01-15T10:00:00.000Z"},
      "visitors": {"$numberLong": "1250"},
      "weather": "sunny",
      "temperature": {"$numberDouble": "18.5"}
    }
  ],
  "createdAt": {"$date": "2023-12-01T00:00:00.000Z"},
  "lastUpdated": {"$timestamp": {"t": 1705689600, "i": 2}}
}`
  }
];

// BSON Type Detection and Conversion Utilities
const isBsonType = (value: any): boolean => {
  if (!value || typeof value !== 'object') return false;
  const bsonTypes = ['$oid', '$date', '$numberLong', '$numberInt', '$numberDouble', '$timestamp', '$binary', '$regex', '$code'];
  return bsonTypes.some(type => type in value);
};

const getBsonTypeInfo = (value: any, path: string = ''): BSONTypeInfo => {
  if (value === null) return { type: 'null', description: 'Null value', icon: '∅' };
  if (value === undefined) return { type: 'undefined', description: 'Undefined value', icon: '?' };

  if (typeof value === 'object' && value !== null) {
    // Check for BSON types first
    if ('$oid' in value) {
      return { type: 'ObjectId', description: 'MongoDB ObjectId', size: 12, icon: '🔑' };
    }
    if ('$date' in value) {
      return { type: 'Date', description: 'BSON Date', size: 8, icon: '📅' };
    }
    if ('$numberLong' in value) {
      return { type: 'Long', description: '64-bit Integer', size: 8, icon: '🔢' };
    }
    if ('$numberInt' in value) {
      return { type: 'Int32', description: '32-bit Integer', size: 4, icon: '🔢' };
    }
    if ('$numberDouble' in value) {
      return { type: 'Double', description: '64-bit Float', size: 8, icon: '🔢' };
    }
    if ('$timestamp' in value) {
      return { type: 'Timestamp', description: 'BSON Timestamp', size: 8, icon: '⏰' };
    }
    if ('$binary' in value) {
      return { type: 'BinData', description: 'Binary Data', icon: '💾' };
    }
    if ('$regex' in value) {
      return { type: 'RegExp', description: 'Regular Expression', icon: '📝' };
    }
    if ('$code' in value) {
      return { type: 'Code', description: 'JavaScript Code', icon: '⚡' };
    }

    if (Array.isArray(value)) {
      return { type: 'Array', description: `Array with ${value.length} elements`, icon: '📋' };
    }

    return { type: 'Object', description: 'Embedded Document', icon: '📄' };
  }

  if (typeof value === 'string') {
    return { type: 'String', description: `String (${value.length} chars)`, icon: '📝' };
  }
  if (typeof value === 'number') {
    return { type: Number.isInteger(value) ? 'Number' : 'Double', description: 'Number', icon: '🔢' };
  }
  if (typeof value === 'boolean') {
    return { type: 'Boolean', description: 'Boolean', icon: '✓' };
  }

  return { type: 'Unknown', description: 'Unknown type', icon: '?' };
};

// Convert Extended JSON to MongoDB Shell format
const convertToShellFormat = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'object') {
    if ('$oid' in obj) {
      return `ObjectId("${obj.$oid}")`;
    }
    if ('$date' in obj) {
      return `ISODate("${new Date(obj.$date).toISOString()}")`;
    }
    if ('$numberLong' in obj) {
      return `NumberLong("${obj.$numberLong}")`;
    }
    if ('$numberInt' in obj) {
      return `NumberInt("${obj.$numberInt}")`;
    }
    if ('$numberDouble' in obj) {
      return `NumberDouble("${obj.$numberDouble}")`;
    }
    if ('$timestamp' in obj) {
      return `Timestamp(${obj.$timestamp.t}, ${obj.$timestamp.i})`;
    }
    if ('$binary' in obj) {
      return `BinData(${obj.$binary.subType}, "${obj.$binary.base64}")`;
    }
    if ('$regex' in obj) {
      return `/${obj.$regex}/${obj.$options || ''}`;
    }
    if ('$code' in obj) {
      return obj.$scope ? `Code("${obj.$code}", ${JSON.stringify(obj.$scope)})` : `Code("${obj.$code}")`;
    }

    if (Array.isArray(obj)) {
      return obj.map(convertToShellFormat);
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = convertToShellFormat(value);
    }
    return result;
  }

  return obj;
};

// Convert MongoDB Shell format to Extended JSON (simplified)
const convertToExtendedJson = (str: string): any => {
  try {
    // Replace MongoDB shell functions with Extended JSON
    let converted = str
      .replace(/ObjectId\("([^"]+)"\)/g, '{"$oid":"$1"}')
      .replace(/ISODate\("([^"]+)"\)/g, '{"$date":"$1"}')
      .replace(/NumberLong\("?([^"]+)"?\)/g, '{"$numberLong":"$1"}')
      .replace(/NumberInt\("?([^"]+)"?\)/g, '{"$numberInt":"$1"}')
      .replace(/NumberDouble\("?([^"]+)"?\)/g, '{"$numberDouble":"$1"}')
      .replace(/Timestamp\((\d+),\s*(\d+)\)/g, '{"$timestamp":{"t":$1,"i":$2}}')
      .replace(/BinData\((\d+),\s*"([^"]+)"\)/g, '{"$binary":{"base64":"$2","subType":"$1"}}')
      .replace(/\/([^\/]+)\/([gimuy]*)/g, '{"$regex":"$1","$options":"$2"}')
      .replace(/Code\("([^"]+)"\)/g, '{"$code":"$1"}');

    return JSON.parse(converted);
  } catch (error) {
    throw new Error(`Failed to convert shell format: ${(error as Error).message}`);
  }
};

// Analyze BSON document
const analyzeBsonDocument = (obj: any): BSONAnalysis => {
  const analysis: BSONAnalysis = {
    documentSize: 0,
    fieldCount: 0,
    types: {},
    depth: 0
  };

  const analyzeValue = (value: any, path: string = '', depth: number = 0) => {
    analysis.depth = Math.max(analysis.depth, depth);

    if (value === null || value === undefined) {
      analysis.fieldCount++;
      return;
    }

    const typeInfo = getBsonTypeInfo(value, path);
    const typeName = `${path || 'root'} (${typeInfo.type})`;
    analysis.types[typeName] = typeInfo;

    if (typeInfo.size) {
      analysis.documentSize += typeInfo.size;
    } else {
      // Estimate size for non-BSON types
      if (typeof value === 'string') {
        analysis.documentSize += value.length + 1;
      } else if (typeof value === 'number') {
        analysis.documentSize += 8;
      } else if (typeof value === 'boolean') {
        analysis.documentSize += 1;
      }
    }

    if (typeof value === 'object' && !isBsonType(value)) {
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          analyzeValue(item, `${path}[${index}]`, depth + 1);
        });
      } else {
        Object.entries(value).forEach(([key, val]) => {
          const newPath = path ? `${path}.${key}` : key;
          analyzeValue(val, newPath, depth + 1);
        });
      }
    }

    analysis.fieldCount++;
  };

  analyzeValue(obj);
  return analysis;
};

// Grade BSON document for performance and best practices
const gradeBsonDocument = (analysis: BSONAnalysis): BSONGrade => {
  const grade: BSONGrade = {
    overall: 'A',
    categories: {
      performance: { grade: 'A', score: 100 },
      network: { grade: 'A', score: 100 },
      memory: { grade: 'A', score: 100 },
      structure: { grade: 'A', score: 100 }
    },
    recommendations: [],
    warnings: [],
    insights: []
  };

  const sizeKB = analysis.documentSize / 1024;
  const sizeMB = sizeKB / 1024;

  // Performance Analysis
  let performanceScore = 100;
  if (analysis.depth > 15) {
    performanceScore -= 20;
    grade.warnings.push(`Deep nesting (${analysis.depth} levels) may slow down queries and indexing`);
  }
  if (analysis.fieldCount > 100) {
    performanceScore -= 15;
    grade.warnings.push(`High field count (${analysis.fieldCount}) can impact query performance`);
  }
  if (sizeKB > 100) {
    performanceScore -= 25;
    grade.warnings.push(`Large document size (${sizeKB.toFixed(1)}KB) may affect read/write performance`);
  }

  // Network Analysis
  let networkScore = 100;
  if (sizeKB > 16) {
    networkScore -= 30;
    grade.warnings.push(`Document size over 16KB will impact network transfer in high-frequency operations`);
  }
  if (sizeKB > 1024) { // 1MB
    networkScore -= 50;
    grade.warnings.push(`Documents over 1MB cause significant network overhead - consider breaking into smaller documents`);
  }

  // Memory Analysis
  let memoryScore = 100;
  if (sizeMB > 16) {
    memoryScore -= 60;
    grade.warnings.push(`Document approaches MongoDB 16MB limit - serious memory concerns`);
  } else if (sizeMB > 8) {
    memoryScore -= 40;
    grade.warnings.push(`Large document (${sizeMB.toFixed(1)}MB) will consume significant memory`);
  }

  // Batch Operation Analysis
  if (sizeKB > 16) {
    grade.recommendations.push(`For batch operations of 1000+ documents: Consider smaller document size (current: ${sizeKB.toFixed(1)}KB each = ${(sizeKB * 1000 / 1024).toFixed(1)}MB total)`);
  }
  if (sizeKB > 50) {
    grade.recommendations.push(`Cloud deployment warning: Documents this size (${sizeKB.toFixed(1)}KB) can cause timeout issues in serverless environments`);
  }

  // Structure Analysis
  let structureScore = 100;
  const hasArrays = Object.values(analysis.types).some(t => t.type === 'Array');
  const hasLargeStrings = Object.values(analysis.types).some(t =>
    t.type === 'String' && t.description.includes('chars') &&
    parseInt(t.description.match(/\d+/)?.[0] || '0') > 1000
  );

  if (hasArrays && analysis.depth > 3) {
    structureScore -= 15;
    grade.insights.push('Nested arrays detected - consider flattening structure for better query performance');
  }
  if (hasLargeStrings) {
    structureScore -= 10;
    grade.insights.push('Large text fields detected - consider storing in GridFS if over 16MB total');
  }

  // Calculate grades
  grade.categories.performance.score = Math.max(0, performanceScore);
  grade.categories.network.score = Math.max(0, networkScore);
  grade.categories.memory.score = Math.max(0, memoryScore);
  grade.categories.structure.score = Math.max(0, structureScore);

  // Assign letter grades
  const getLetterGrade = (score: number): 'A' | 'B' | 'C' | 'D' | 'F' => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  grade.categories.performance.grade = getLetterGrade(performanceScore);
  grade.categories.network.grade = getLetterGrade(networkScore);
  grade.categories.memory.grade = getLetterGrade(memoryScore);
  grade.categories.structure.grade = getLetterGrade(structureScore);

  // Overall grade (weighted average)
  const overallScore = (performanceScore * 0.3 + networkScore * 0.3 + memoryScore * 0.25 + structureScore * 0.15);
  grade.overall = getLetterGrade(overallScore);

  // Add positive insights
  if (sizeKB < 16) {
    grade.insights.push('✅ Excellent size for high-frequency operations and network efficiency');
  }
  if (analysis.depth <= 5) {
    grade.insights.push('✅ Good document structure - shallow nesting promotes query performance');
  }
  if (analysis.fieldCount < 50) {
    grade.insights.push('✅ Reasonable field count - should index and query efficiently');
  }

  // Use case recommendations
  if (overallScore >= 85) {
    grade.recommendations.push('💡 Suitable for: Real-time applications, mobile apps, high-frequency API calls');
  } else if (overallScore >= 70) {
    grade.recommendations.push('💡 Suitable for: Standard web applications, moderate-frequency operations');
  } else if (overallScore >= 50) {
    grade.recommendations.push('💡 Suitable for: Batch processing, data warehousing, infrequent large queries');
  } else {
    grade.recommendations.push('⚠️  Consider restructuring: This document may cause performance issues in most use cases');
  }

  return grade;
};

// Validate BSON document
const validateBsonDocument = (input: string): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    info: []
  };

  if (!input.trim()) {
    result.errors.push('Input is empty');
    result.isValid = false;
    return result;
  }

  try {
    const obj = JSON.parse(input);
    const analysis = analyzeBsonDocument(obj);

    // Check document size (MongoDB limit is 16MB)
    if (analysis.documentSize > 16 * 1024 * 1024) {
      result.errors.push('Document size exceeds MongoDB 16MB limit');
      result.isValid = false;
    } else if (analysis.documentSize > 8 * 1024 * 1024) {
      result.warnings.push('Document size is large (>8MB)');
    }

    // Check nesting depth
    if (analysis.depth > 100) {
      result.warnings.push('Document has deep nesting (>100 levels)');
    }

    result.info.push(`Document size: ${(analysis.documentSize / 1024).toFixed(2)} KB`);
    result.info.push(`Field count: ${analysis.fieldCount}`);
    result.info.push(`Nesting depth: ${analysis.depth}`);

    // Check for potential issues
    Object.entries(analysis.types).forEach(([path, typeInfo]) => {
      if (typeInfo.type === 'String' && path.includes('_id')) {
        result.warnings.push(`Field "${path}" might be better as ObjectId`);
      }
    });

  } catch (error) {
    result.errors.push(`Invalid JSON: ${(error as Error).message}`);
    result.isValid = false;
  }

  return result;
};

const BSONTool: React.FC<BSONToolProps> = ({ editorHeight = '800px' }) => {
  const { theme } = useTheme();

  const [inputValue, setInputValue] = useState('{\n  "_id": {"$oid": "507f1f77bcf86cd799439011"},\n  "name": "John Doe",\n  "age": {"$numberInt": "30"},\n  "createdAt": {"$date": "2023-01-01T00:00:00.000Z"},\n  "metadata": {\n    "version": {"$numberLong": "1"},\n    "active": true\n  }\n}');
  const [outputValue, setOutputValue] = useState('');
  const [conversionMode, setConversionMode] = useState<'toShell' | 'toExtended'>('toShell');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [analysis, setAnalysis] = useState<BSONAnalysis | null>(null);
  const [bsonGrade, setBsonGrade] = useState<BSONGrade | null>(null);
  const [showInspector, setShowInspector] = useState(true); // Default to true for better UX
  const [showTemplates, setShowTemplates] = useState(false);
  const templatesRef = useRef<HTMLDivElement>(null);

  // Group templates by category
  const templatesByCategory = useMemo(() => {
    const grouped: Record<string, BSONTemplate[]> = {};
    BSON_TEMPLATES.forEach(template => {
      if (!grouped[template.category]) {
        grouped[template.category] = [];
      }
      grouped[template.category].push(template);
    });
    return grouped;
  }, []);

  // Load template into input
  const loadTemplate = useCallback((template: BSONTemplate) => {
    setInputValue(template.content);
    setShowTemplates(false);
  }, []);

  // Handle click outside templates dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (templatesRef.current && !templatesRef.current.contains(event.target as Node)) {
        setShowTemplates(false);
      }
    };

    if (showTemplates) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showTemplates]);

  // Auto-convert when input changes
  useEffect(() => {
    if (!inputValue.trim()) {
      setOutputValue('');
      setValidation(null);
      setAnalysis(null);
      setBsonGrade(null);
      return;
    }

    try {
      const validationResult = validateBsonDocument(inputValue);
      setValidation(validationResult);

      if (validationResult.isValid) {
        const inputObj = JSON.parse(inputValue);
        const analysisResult = analyzeBsonDocument(inputObj);
        const gradeResult = gradeBsonDocument(analysisResult);
        setAnalysis(analysisResult);
        setBsonGrade(gradeResult);

        if (conversionMode === 'toShell') {
          const shellFormat = convertToShellFormat(inputObj);
          setOutputValue(JSON.stringify(shellFormat, null, 2));
        } else {
          // For extended JSON, just format it nicely
          setOutputValue(JSON.stringify(inputObj, null, 2));
        }
      } else {
        setOutputValue('');
        setAnalysis(null);
        setBsonGrade(null);
      }
    } catch (error) {
      setOutputValue('');
      setAnalysis(null);
      setBsonGrade(null);
    }
  }, [inputValue, conversionMode]);

  const handleConvert = useCallback(() => {
    if (!validation?.isValid) return;

    try {
      if (conversionMode === 'toShell') {
        const obj = JSON.parse(inputValue);
        const shellFormat = convertToShellFormat(obj);
        setOutputValue(JSON.stringify(shellFormat, null, 2));
      } else {
        // Try to convert shell format to extended JSON
        const extendedJson = convertToExtendedJson(inputValue);
        setOutputValue(JSON.stringify(extendedJson, null, 2));
      }
    } catch (error) {
      console.error('Conversion error:', error);
    }
  }, [inputValue, conversionMode, validation]);

  const handleSwapPanes = useCallback(() => {
    const tempValue = inputValue;
    setInputValue(outputValue);
    setOutputValue(tempValue);
    setConversionMode(conversionMode === 'toShell' ? 'toExtended' : 'toShell');
  }, [inputValue, outputValue, conversionMode]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const formatDocument = useCallback(() => {
    try {
      const obj = JSON.parse(inputValue);
      setInputValue(JSON.stringify(obj, null, 2));
    } catch (error) {
      console.error('Format error:', error);
    }
  }, [inputValue]);

  const editorActualHeight = useMemo(() => {
    // Fixed height for editors in constrained layout - inspector is now in scrollable area
    return 500; // Fixed height that works well in the layout
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Fixed Header Section */}
      <div className="flex-none p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">BSON Tools</h2>
          <div className="flex items-center space-x-2">
            <div className="relative" ref={templatesRef}>
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="flex items-center px-3 py-1 text-sm bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
                title="Load Sample Templates"
              >
                <BookOpenIcon className="w-4 h-4 mr-1" />
                Templates
                <ChevronDownIcon className={`w-3 h-3 ml-1 transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
              </button>

              {showTemplates && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                  {Object.entries(templatesByCategory).map(([category, templates]) => (
                    <div key={category} className="p-2">
                      <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 px-2">
                        {category}
                      </div>
                      {templates.map((template) => (
                        <button
                          key={template.name}
                          onClick={() => loadTemplate(template)}
                          className="w-full text-left p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 mb-1"
                        >
                          <div className="font-medium text-sm">{template.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{template.description}</div>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={formatDocument}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              title="Format JSON"
            >
              Format
            </button>
            <button
              onClick={() => setShowInspector(!showInspector)}
              className={`flex items-center px-3 py-1 text-sm rounded transition-colors ${showInspector ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              title="Toggle BSON Analysis & Grading"
            >
              <EyeIcon className="w-4 h-4 mr-1" />
              {showInspector ? 'Hide' : 'Show'} Analysis
            </button>
          </div>
        </div>

        {/* Validation Status */}
        {validation && (
          <div className="mb-4 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center space-x-2 mb-2">
              {validation.isValid ? (
                <CheckCircleIcon className="w-5 h-5 text-green-500" />
              ) : (
                <XCircleIcon className="w-5 h-5 text-red-500" />
              )}
              <span className={`font-medium ${validation.isValid ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                {validation.isValid ? 'Valid BSON' : 'Invalid BSON'}
              </span>
            </div>

            {validation.errors.map((error, index) => (
              <div key={index} className="text-red-600 dark:text-red-400 text-sm">• {error}</div>
            ))}

            {validation.warnings.map((warning, index) => (
              <div key={index} className="text-yellow-600 dark:text-yellow-400 text-sm">• {warning}</div>
            ))}

            {validation.info.map((info, index) => (
              <div key={index} className="text-blue-600 dark:text-blue-400 text-sm">• {info}</div>
            ))}
          </div>
        )}

        {/* Conversion Controls */}
        <div className="flex items-center justify-center space-x-4 mb-4 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">Extended JSON</span>
            <button
              onClick={() => setConversionMode('toShell')}
              className={`p-2 rounded ${conversionMode === 'toShell' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
              title="Convert to Shell Format"
            >
              <ArrowRightIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setConversionMode('toExtended')}
              className={`p-2 rounded ${conversionMode === 'toExtended' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
              title="Convert to Extended JSON"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Shell Format</span>
          </div>
          <button
            onClick={handleSwapPanes}
            className="px-3 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
            title="Swap Input/Output"
          >
            ⇄ Swap
          </button>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 space-y-4">

          {/* Dual Pane Editors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"
            style={{ height: `${editorActualHeight}px` }}
          >
            {/* Input Pane */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Input</h3>
                <button
                  onClick={() => copyToClipboard(inputValue)}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  title="Copy to clipboard"
                >
                  <ClipboardDocumentIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1">
                <MonacoEditor
                  value={inputValue}
                  onChange={(value) => setInputValue(value || '')}
                  language="json"
                  theme={theme === 'dark' ? 'vs-dark' : 'light'}
                  height={`${editorActualHeight}px`}
                />
              </div>
            </div>

            {/* Output Pane */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Output</h3>
                <button
                  onClick={() => copyToClipboard(outputValue)}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  title="Copy to clipboard"
                >
                  <ClipboardDocumentIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1">
                <MonacoEditor
                  value={outputValue}
                  onChange={() => { }}
                  language="json"
                  theme={theme === 'dark' ? 'vs-dark' : 'light'}
                  height={`${editorActualHeight}px`}
                />
              </div>

              {/* Enhanced Inspector Panel */}
              {showInspector && analysis && bsonGrade && (
                <div className="mt-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                  <div className="bg-gray-50 dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-semibold flex items-center text-gray-900 dark:text-white">
                        <DocumentTextIcon className="w-6 h-6 mr-2" />
                        BSON Analysis & Performance Grading
                      </h3>
                      <div className="flex items-center space-x-4">
                        {/* Quick Grade Summary */}
                        <div className="hidden md:flex items-center space-x-2 text-xs">
                          <span className="text-gray-500 dark:text-gray-400">Quick View:</span>
                          {Object.entries(bsonGrade.categories).map(([category, data]) => (
                            <span key={category} className={`px-2 py-1 rounded text-xs font-medium ${data.grade === 'A' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                data.grade === 'B' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                  data.grade === 'C' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                    data.grade === 'D' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                      'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              }`}>
                              {category.charAt(0).toUpperCase()}: {data.grade}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Overall:</span>
                          <div className={`px-3 py-1 rounded-full font-bold text-lg ${bsonGrade.overall === 'A' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                              bsonGrade.overall === 'B' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                bsonGrade.overall === 'C' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                  bsonGrade.overall === 'D' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                    'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                            {bsonGrade.overall}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Grading Methodology Disclaimer */}
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-blue-700 dark:text-blue-300">
                          <div className="font-medium mb-1">How We Grade Your BSON</div>
                          <div className="text-xs space-y-1">
                            <div><strong>Performance (30%):</strong> Query speed, indexing efficiency, field count impact</div>
                            <div><strong>Network (30%):</strong> Transfer overhead, bandwidth usage, cloud performance</div>
                            <div><strong>Memory (25%):</strong> RAM consumption, MongoDB 16MB limits, batch operations</div>
                            <div><strong>Structure (15%):</strong> Nesting depth, array complexity, field organization</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Left Column: Metrics & Grades */}
                      <div className="space-y-6">
                        {/* Document Metrics */}
                        <div>
                          <h4 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Document Metrics</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border">
                              <div className="text-sm text-gray-500 dark:text-gray-400">Document Size</div>
                              <div className="text-xl font-bold text-gray-900 dark:text-white">{(analysis.documentSize / 1024).toFixed(2)} KB</div>
                            </div>
                            <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border">
                              <div className="text-sm text-gray-500 dark:text-gray-400">Field Count</div>
                              <div className="text-xl font-bold text-gray-900 dark:text-white">{analysis.fieldCount}</div>
                            </div>
                            <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border">
                              <div className="text-sm text-gray-500 dark:text-gray-400">Nesting Depth</div>
                              <div className="text-xl font-bold text-gray-900 dark:text-white">{analysis.depth}</div>
                            </div>
                            <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border">
                              <div className="text-sm text-gray-500 dark:text-gray-400">Unique Types</div>
                              <div className="text-xl font-bold text-gray-900 dark:text-white">{Object.keys(analysis.types).length}</div>
                            </div>
                          </div>
                        </div>

                        {/* Performance Grades */}
                        <div>
                          <h4 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Performance Categories</h4>
                          <div className="space-y-3">
                            {Object.entries(bsonGrade.categories).map(([category, data]) => (
                              <div key={category} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg border">
                                <div>
                                  <span className="font-medium capitalize text-gray-900 dark:text-white">{category}</span>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">{data.score}/100</div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <div className="w-20 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full transition-all duration-300 ${data.grade === 'A' ? 'bg-green-500' :
                                          data.grade === 'B' ? 'bg-blue-500' :
                                            data.grade === 'C' ? 'bg-yellow-500' :
                                              data.grade === 'D' ? 'bg-orange-500' : 'bg-red-500'
                                        }`}
                                      style={{ width: `${data.score}%` }}
                                    ></div>
                                  </div>
                                  <span className={`font-bold px-2 py-1 rounded text-sm ${data.grade === 'A' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                      data.grade === 'B' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                        data.grade === 'C' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                          data.grade === 'D' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                            'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                    }`}>
                                    {data.grade}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Recommendations & Field Types */}
                      <div className="space-y-6">
                        {/* Recommendations */}
                        {(bsonGrade.recommendations.length > 0 || bsonGrade.warnings.length > 0 || bsonGrade.insights.length > 0) && (
                          <div>
                            <h4 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Recommendations & Insights</h4>
                            <div className="space-y-3">
                              {bsonGrade.warnings.map((warning, index) => (
                                <div key={index} className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                  <div className="flex items-center">
                                    <span className="text-red-600 dark:text-red-400 mr-2">⚠️</span>
                                    <span className="text-sm text-red-700 dark:text-red-300">{warning}</span>
                                  </div>
                                </div>
                              ))}

                              {bsonGrade.recommendations.map((rec, index) => (
                                <div key={index} className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                  <div className="flex items-start">
                                    <span className="text-blue-600 dark:text-blue-400 mr-2 mt-0.5">💡</span>
                                    <span className="text-sm text-blue-700 dark:text-blue-300">{rec}</span>
                                  </div>
                                </div>
                              ))}

                              {bsonGrade.insights.map((insight, index) => (
                                <div key={index} className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                  <div className="flex items-start">
                                    <span className="text-green-600 dark:text-green-400 mr-2 mt-0.5">✨</span>
                                    <span className="text-sm text-green-700 dark:text-green-300">{insight}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Field Types */}
                        <div>
                          <h4 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Field Type Breakdown</h4>
                          <div className="max-h-80 overflow-y-auto bg-white dark:bg-gray-700 rounded-lg border p-4">
                            <div className="space-y-2">
                              {Object.entries(analysis.types).map(([path, typeInfo]) => (
                                <div key={path} className="flex items-center space-x-3 text-sm p-2 hover:bg-gray-50 dark:hover:bg-gray-600 rounded">
                                  <span className="text-lg">{typeInfo.icon}</span>
                                  <span className="font-mono text-blue-600 dark:text-blue-400 flex-1 truncate">{path}</span>
                                  <span className="text-gray-400 dark:text-gray-500">→</span>
                                  <span className="font-medium text-gray-900 dark:text-white">{typeInfo.type}</span>
                                  <span className="text-gray-500 dark:text-gray-400 text-xs">({typeInfo.description})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BSONTool;