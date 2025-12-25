import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import KafkaTester from '../index';

describe('Kafka Tester', () => {
    const mockState = {
        step: 1,
        config: {
            brokers: ['localhost:9092'],
            clientId: 'kafka-tester',
        },
        messageConfig: { value: '' },
        messages: [],
        error: null,
        isConnected: false,
        topics: [],
    };
    const mockSetState = vi.fn();

    it('renders correctly', () => {
        render(<KafkaTester state={mockState} setState={mockSetState} />);
        expect(screen.getAllByText(/Connect/i).length).toBeGreaterThan(0);
    });
});
