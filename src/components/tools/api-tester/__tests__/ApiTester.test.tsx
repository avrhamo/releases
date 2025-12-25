import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ApiTester } from '../ApiTester';

// Mock the electronAPI
const mockExecuteRequest = vi.fn();
window.electronAPI = {
    executeRequest: mockExecuteRequest,
    // Add other mocked methods as needed
} as any;

describe('ApiTester', () => {
    const mockState = {
        step: 1,
        connectionConfig: { connectionString: 'mongodb://localhost:27017' },
        curlConfig: { parsedCommand: { rawCommand: '' }, mappedFields: {} },
        testConfig: { numberOfRequests: 1, isAsync: false, batchSize: 100 },
        availableFields: [],
    };
    const mockSetState = vi.fn();

    it('renders correctly', () => {
        render(<ApiTester state={mockState} setState={mockSetState} />);
        expect(screen.getAllByText(/Connect/i).length).toBeGreaterThan(0);
    });

    // Add more tests as needed
});
