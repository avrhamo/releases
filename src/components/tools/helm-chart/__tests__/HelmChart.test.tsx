import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import HelmChart from '../index';

// Mock electronAPI
const mockSelectChart = vi.fn();
const mockReadChart = vi.fn();
const mockScanTemplates = vi.fn();
const mockLint = vi.fn();
const mockTemplate = vi.fn();

window.electronAPI = {
    ...window.electronAPI,
    helm: {
        selectChart: mockSelectChart,
        readChart: mockReadChart,
        scanTemplates: mockScanTemplates,
        lint: mockLint,
        template: mockTemplate,
    },
} as any;

describe('HelmChart Tool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders initial state correctly', () => {
        render(<HelmChart />);
        expect(screen.getByText(/Helm Chart Analyzer/i)).toBeInTheDocument();
        expect(screen.getByText(/Select a chart to analyze/i)).toBeInTheDocument();
        expect(screen.getByText(/Select Chart Directory/i)).toBeInTheDocument();
    });

    it('handles chart selection and data loading', async () => {
        mockSelectChart.mockResolvedValue('/path/to/chart');
        mockReadChart.mockResolvedValue({
            success: true,
            chartYaml: 'name: test-chart\nversion: 1.0.0\ndescription: A test chart',
            valuesYaml: 'replicaCount: 1',
        });
        mockScanTemplates.mockResolvedValue({
            success: true,
            files: [{ name: 'deployment.yaml', path: 'templates/deployment.yaml', content: 'kind: Deployment\nmetadata:\n  name: test-deployment' }]
        });
        mockLint.mockResolvedValue({ success: true, output: 'Linting passed' });
        mockTemplate.mockResolvedValue({ success: true, output: 'kind: Deployment\nmetadata:\n  name: test-deployment' });

        render(<HelmChart />);

        const selectButton = screen.getByText(/Select Chart Directory/i);
        fireEvent.click(selectButton);

        await waitFor(() => {
            expect(mockSelectChart).toHaveBeenCalled();
        });

        await waitFor(() => {
            expect(screen.getByText('test-chart')).toBeInTheDocument();
            expect(screen.getByText('A test chart')).toBeInTheDocument();
        });

        // Check if analysis results are displayed (Workloads: 1 Deployment)
        // The component calculates workloads: deployments + statefulSets + daemonSets
        // We expect 1 Deployment
        expect(screen.getByText('Workloads')).toBeInTheDocument();
        const counts = screen.getAllByText('1');
        expect(counts.length).toBeGreaterThan(0);
    });

    it('displays error when chart selection fails', async () => {
        mockSelectChart.mockRejectedValue(new Error('Selection failed'));

        render(<HelmChart />);

        const selectButton = screen.getByText(/Select Chart Directory/i);
        fireEvent.click(selectButton);

        await waitFor(() => {
            expect(screen.getByText(/Failed to select chart/i)).toBeInTheDocument();
        });
    });
});
