import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Base64 from '../index'; // Assuming index exports the component

describe('Base64 Tool', () => {
    const mockState = {
        mode: 'encode',
        input: '',
        output: '',
        error: null,
        copied: null,
    };
    const mockSetState = vi.fn();

    it('renders correctly', () => {
        render(<Base64 state={mockState} setState={mockSetState} />);
        expect(screen.getByText(/Base64 Encoder\/Decoder/i)).toBeDefined();
    });

    it('updates input state on change', () => {
        render(<Base64 state={mockState} setState={mockSetState} />);
        const input = screen.getByPlaceholderText(/Enter text/i); // Adjust selector based on actual UI
        fireEvent.change(input, { target: { value: 'test' } });
        expect(mockSetState).toHaveBeenCalledWith(expect.objectContaining({ textInput: 'test' }));
    });
});
