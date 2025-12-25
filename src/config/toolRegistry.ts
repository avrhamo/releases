import {
    CodeBracketIcon,
    LockClosedIcon,
    KeyIcon,
    CloudIcon,
    CommandLineIcon,
    DocumentTextIcon,
    ClockIcon,
    CubeTransparentIcon,
    ShieldCheckIcon,
    DocumentDuplicateIcon,
    DocumentMagnifyingGlassIcon,
    CodeBracketSquareIcon,
    SwatchIcon,
    ExclamationTriangleIcon,
    FaceSmileIcon,
    InformationCircleIcon,
    ServerIcon
} from '@heroicons/react/24/outline';
import React from 'react';

// Lazy load tool components
const Base64Tool = React.lazy(() => import('../components/tools/base64'));
const ApiTester = React.lazy(() => import('../components/tools/api-tester'));
const RSATool = React.lazy(() => import('../components/tools/rsa'));
const KeytabTool = React.lazy(() => import('../components/tools/keytab'));
const KafkaTester = React.lazy(() => import('../components/tools/kafka-tester'));
const RegexTool = React.lazy(() => import('../components/tools/regex'));
const TimeUnitsTool = React.lazy(() => import('../components/tools/time-units'));
const SizeUnitsTool = React.lazy(() => import('../components/tools/size-units'));
const HashTool = React.lazy(() => import('../components/tools/hash'));
const BSONTool = React.lazy(() => import('../components/tools/bson'));
const HelmChart = React.lazy(() => import('../components/tools/helm-chart'));
const JWTTool = React.lazy(() => import('../components/tools/jwt'));
const TextCompareTool = React.lazy(() => import('../components/tools/text-compare'));
const POJOCreator = React.lazy(() => import('../components/tools/pojo-creator'));
const OpenAPIGenerator = React.lazy(() => import('../components/tools/openapi-generator'));
const PortKiller = React.lazy(() => import('../components/tools/port-killer'));
const WaitingRoom = React.lazy(() => import('../components/tools/waiting-room'));
const About = React.lazy(() => import('../components/tools/about'));

export const TOOL_COMPONENTS: Record<string, any> = {
    'base64': Base64Tool,
    'rsa': RSATool,
    'keytab': KeytabTool,
    'api-tester': ApiTester,
    'kafka': KafkaTester,
    'regex': RegexTool,
    'time': TimeUnitsTool,
    'size-units': SizeUnitsTool,
    'hash': HashTool,
    'bson': BSONTool,
    'helm-chart': HelmChart,
    'jwt': JWTTool,
    'text-compare': TextCompareTool,
    'pojo-creator': POJOCreator,
    'openapi-generator': OpenAPIGenerator,
    'port-killer': PortKiller,
    'waiting-room': WaitingRoom,
    'about': About,
};

export const TOOL_LABELS: Record<string, string> = {
    'base64': 'Base64',
    'rsa': 'RSA',
    'keytab': 'Keytab',
    'api-tester': 'API Tester',
    'kafka': 'Kafka Tester',
    'regex': 'Regex',
    'time': 'Time Units',
    'size-units': 'Size Units',
    'hash': 'Hash Generator',
    'bson': 'BSON Tools',
    'helm-chart': 'Helm Chart Analyzer',
    'jwt': 'JWT Tools',
    'text-compare': 'Text Compare',
    'pojo-creator': 'POJO Creator',
    'openapi-generator': 'OpenAPI Generator',
    'port-killer': 'Port Killer',
    'waiting-room': 'Waiting Room',
    'about': 'About',
};

export const TOOL_ICONS: Record<string, any> = {
    'base64': CodeBracketIcon,
    'rsa': LockClosedIcon,
    'keytab': KeyIcon,
    'api-tester': CloudIcon,
    'kafka': CommandLineIcon,
    'regex': DocumentTextIcon,
    'time': ClockIcon,
    'size-units': ServerIcon,
    'hash': ShieldCheckIcon,
    'bson': CubeTransparentIcon,
    'helm-chart': CubeTransparentIcon,
    'jwt': DocumentDuplicateIcon,
    'text-compare': DocumentMagnifyingGlassIcon,
    'pojo-creator': CodeBracketSquareIcon,
    'openapi-generator': SwatchIcon,
    'port-killer': ExclamationTriangleIcon,
    'waiting-room': FaceSmileIcon,
    'about': InformationCircleIcon,
};

export const DEFAULT_TOOL_STATES: Record<string, any> = {
    'base64': {
        mode: 'encode',
        textInput: '',
        textOutput: '',
        error: null,
        fileType: null,
        fileName: null,
        isProcessing: false,
        progress: 0,
        progressMessage: '',
        copySuccess: false,
        useMonacoForInput: true,
        useMonacoForOutput: true,
        showFilePreview: true,
        showRawView: false,
    },
    'api-tester': {
        step: 1,
        connectionConfig: {
            connectionString: 'mongodb://localhost:27017',
        },
        curlConfig: {
            parsedCommand: {
                rawCommand: ''
            },
            mappedFields: {},
        },
        testConfig: {
            numberOfRequests: 1,
            isAsync: false,
            batchSize: 100,
        },
        availableFields: [],
    },
    'kafka': {
        step: 1,
        config: {
            brokers: ['localhost:9092'],
            clientId: 'kafka-tester',
            topic: undefined,
            groupId: undefined
        },
        messageConfig: {
            value: '',
            key: undefined,
            headers: undefined
        },
        messages: [],
        error: null,
        isConnected: false,
        topics: [],
        consumerId: undefined
    },
    'helm-chart': {
        chartPath: '',
        chartMetadata: null,
        values: '',
        templates: [],
        analysis: null,
        lintResult: null,
        templateResult: null,
        isLoading: false,
        activeTab: 'overview',
        error: null
    },
    'jwt': {
        token: '',
        decodedHeader: null,
        decodedPayload: null,
        signature: null,
        isVerified: false,
        error: null,
        secret: '',
        algorithm: 'HS256',
    },
    'text-compare': {
        leftText: '',
        rightText: '',
        diffResult: null,
        showWhitespace: true,
        caseSensitive: true,
        error: null,

    },
    'pojo-creator': {
        jsonInput: '',
        generatedCode: '',
        targetLanguage: 'java',
        className: 'GeneratedClass',
        packageName: 'com.example',
        error: null,
        options: {
            useLombok: true,
            useJackson: true,
            useValidation: true,
            useBuilder: false,
            generateDummyUtils: false,
            usePrimitiveTypes: false,
            parseBsonTypes: false,
        },
    },
    'openapi-generator': {
        apiDefinition: '',
        generatedSpec: null,
        error: null,
        options: {
            version: '3.0.0',
            title: 'API Documentation',
            description: '',
            basePath: '/api',
            includeExamples: true,
        },
    },
    'size-units': {
        inputValue: '',
        outputValue: '',
        fromUnit: 'bytes',
        toUnit: 'kilobytes',
        copySuccess: false,
        history: [],
        favorites: ['bytes', 'KB', 'MB', 'GB', 'KiB', 'MiB', 'GiB'],
        showContext: true,
        currentTimestamp: Date.now()
    },
    'hash': {
        inputText: '',
        selectedAlgorithm: 'sha256',
        outputHash: '',
        secretKey: '',
        showSecretKey: false,
        copySuccess: false,
        fileHash: '',
        fileName: '',
        hashHistory: [],
        compareMode: false,
        compareHash: '',
        compareResult: null
    },
    'keytab': {
        entries: [],
        error: null,
        fileName: null,
        isProcessing: false
    },
};
