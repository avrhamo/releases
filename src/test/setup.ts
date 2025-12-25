import '@testing-library/jest-dom';

// Mock document.queryCommandSupported for Monaco Editor
document.queryCommandSupported = () => false;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: any) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => { }, // Deprecated
        removeListener: () => { }, // Deprecated
        addEventListener: () => { },
        removeEventListener: () => { },
        dispatchEvent: () => { },
    }),
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};
