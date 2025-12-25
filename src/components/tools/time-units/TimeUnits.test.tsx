import React, { useState, useCallback, useEffect } from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import TimeUnits from './index';
import { vi, describe, it, expect } from 'vitest';

// Mock the hook if needed, or just rely on props since TimeUnits uses useToolState which uses props
// But TimeUnits imports useToolState. 
// We can test the component by passing props that mimic App.tsx behavior (unstable setState)

describe('TimeUnits Infinite Loop', () => {
    it('should not update history infinitely', async () => {
        const TestWrapper = () => {
            const [state, _setState] = useState({
                inputValue: '1',
                outputValue: '60',
                fromUnit: 'minutes',
                toUnit: 'seconds',
                history: [],
                showContext: true,
                currentTimestamp: Date.now()
            });

            // Simulate unstable setState (recreated every render)
            const setState = (update: any) => {
                _setState(prev => ({ ...prev, ...update }));
            };

            return <TimeUnits state={state} setState={setState} />;
        };

        const { unmount } = render(<TestWrapper />);

        // Wait for initial effects
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 1100));
        });

        // Check if history has grown excessively
        // This is hard to check directly without inspecting state, 
        // but we can check if console logs or if we can spy on setState.

        unmount();
    });

    it('reproduction with spy', async () => {
        let renderCount = 0;
        const setStateSpy = vi.fn();

        const TestWrapper = () => {
            renderCount++;
            const [state, _setState] = useState({
                inputValue: '1',
                outputValue: '60',
                fromUnit: 'minutes',
                toUnit: 'seconds',
                history: [],
                showContext: true,
                currentTimestamp: Date.now()
            });

            // Unstable setState
            const setState = (update: any) => {
                setStateSpy(update);
                _setState(prev => ({ ...prev, ...update }));
            };

            return <TimeUnits state={state} setState={setState} />;
        };

        render(<TestWrapper />);

        // Wait for loop
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 2500));
        });

        // If loop exists, setStateSpy should be called multiple times (every 1s)
        // Initial render -> wait 1s -> setState(history) -> re-render -> wait 1s -> setState(history) -> ...
        // In 2.5s, it should be called at least 2 times if looping.
        // If fixed, it should be called once (initial add to history) and then stop.

        const historyUpdates = setStateSpy.mock.calls.filter(call => call[0].history);
        console.log('History update count:', historyUpdates.length);
        expect(historyUpdates.length).toBeLessThanOrEqual(1);
    });
});
