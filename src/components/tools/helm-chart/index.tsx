import React, { useState, useCallback } from 'react';
import {
  FolderOpenIcon,
  DocumentTextIcon,
  CubeIcon,
  ServerStackIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  GlobeAltIcon,
  ChevronDownIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import MonacoEditor from '../../common/editor/MonacoEditor';
import { useTheme } from '../../../hooks/useTheme';

interface HelmChartState {
  chartPath: string;
  chartMetadata: any | null;
  values: string;
  templates: any[];
  analysis: any | null;
  lintResult: { output: string; error: string; success: boolean } | null;
  templateResult: { output: string; error: string; success: boolean } | null;
  isLoading: boolean;
  activeTab: 'overview' | 'injections' | 'storage' | 'network' | 'scaling' | 'lint' | 'files';
  error: string | null;
}

const HelmChart: React.FC = () => {
  const [state, setState] = useState<HelmChartState>({
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
  });
  const [selectedFileContent, setSelectedFileContent] = useState<string>('');
  const [selectedFilePath, setSelectedFilePath] = useState<string>('');
  const [activeOverviewCategory, setActiveOverviewCategory] = useState<string | null>(null);

  const { theme } = useTheme();

  const handleSelectChart = useCallback(async () => {
    try {
      const path = await window.electronAPI.helm.selectChart();
      if (path) {
        setState(prev => ({ ...prev, chartPath: path, isLoading: true, error: null }));
        await loadChartData(path);
      }
    } catch (err) {
      setState(prev => ({ ...prev, error: 'Failed to select chart', isLoading: false }));
    }
  }, []);

  const loadChartData = async (path: string) => {
    try {
      // Read Chart.yaml and values.yaml
      const { success, chartYaml, valuesYaml, error } = await window.electronAPI.helm.readChart(path);
      if (!success) {
        throw new Error(error);
      }

      // Parse Chart.yaml
      const nameMatch = chartYaml.match(/^name:\s*(.+)$/m);
      const versionMatch = chartYaml.match(/^version:\s*(.+)$/m);
      const descMatch = chartYaml.match(/^description:\s*(.+)$/m);

      const metadata = {
        name: nameMatch ? nameMatch[1].trim() : 'Unknown',
        version: versionMatch ? versionMatch[1].trim() : 'Unknown',
        description: descMatch ? descMatch[1].trim() : 'No description',
        raw: chartYaml
      };

      // Scan templates
      const { success: scanSuccess, files } = await window.electronAPI.helm.scanTemplates(path);
      if (!scanSuccess) {
        console.warn('Failed to scan templates');
      }

      // Run Lint
      const lintRes = await window.electronAPI.helm.lint(path);

      // Run Template (optional, for analysis)
      const tplRes = await window.electronAPI.helm.template(path);

      // Analyze resources
      const analysis = analyzeChart(files || [], tplRes.success ? tplRes.output : '');

      setState(prev => ({
        ...prev,
        chartMetadata: metadata,
        values: valuesYaml,
        templates: files || [],
        lintResult: lintRes,
        templateResult: tplRes,
        analysis,
        isLoading: false
      }));

      // Set default file content
      setSelectedFileContent(valuesYaml);
      setSelectedFilePath('values.yaml');

    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load chart data',
        isLoading: false
      }));
    }
  };

  const analyzeChart = (files: any[], templateOutput: string) => {
    const resources = {
      deployments: [] as string[],
      statefulSets: [] as string[],
      daemonSets: [] as string[],
      services: [] as string[],
      ingresses: [] as string[],
      secrets: [] as string[],
      configMaps: [] as string[],
      pvcs: [] as string[],
      hpas: [] as string[],
      serviceAccounts: [] as string[]
    };

    const contentToAnalyze = templateOutput || files.map(f => f.content).join('\n---\n');

    // Helper to extract names based on kind
    const extractNames = (kind: string) => {
      // Improved regex to capture metadata name block
      // Looks for kind: <Kind> followed eventually by metadata: name: <Name>
      // This is a simple approximation. For robust parsing, a YAML parser is better.
      // We'll split by "---" to handle multiple documents and regex each document.
      const docs = contentToAnalyze.split(/^---$/m);
      const names: string[] = [];

      docs.forEach(doc => {
        if (new RegExp(`kind:\\s*${kind}`, 'i').test(doc)) {
          const nameMatch = doc.match(/metadata:\s*\n\s*name:\s*([a-zA-Z0-9-]+)/) ||
            doc.match(/metadata:\s*\n\s*.*?\n\s*name:\s*([a-zA-Z0-9-]+)/s); // Handle labels before name
          if (nameMatch) {
            names.push(nameMatch[1]);
          } else {
            // Fallback: try to find name on same line or next line if simple format
            const simpleName = doc.match(/name:\s*([a-zA-Z0-9-]+)/);
            if (simpleName) names.push(simpleName[1]);
          }
        }
      });
      return names;
    };

    resources.deployments = extractNames('Deployment');
    resources.statefulSets = extractNames('StatefulSet');
    resources.daemonSets = extractNames('DaemonSet');
    resources.services = extractNames('Service');
    resources.ingresses = extractNames('Ingress');
    resources.secrets = extractNames('Secret');
    resources.configMaps = extractNames('ConfigMap');
    resources.pvcs = extractNames('PersistentVolumeClaim');
    resources.hpas = extractNames('HorizontalPodAutoscaler');
    resources.serviceAccounts = extractNames('ServiceAccount');

    return resources;
  };

  const renderOverviewCard = (title: string, Icon: React.ElementType, count: number, _items: string[], colorClass: string) => (
    <div
      onClick={() => count > 0 && setActiveOverviewCategory(activeOverviewCategory === title ? null : title)}
      className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow border transition-all duration-200 ${count > 0 ? 'cursor-pointer hover:shadow-md' : ''
        } ${activeOverviewCategory === title
          ? 'border-blue-500 ring-2 ring-blue-500/20 dark:ring-blue-500/40'
          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
        }`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
        <Icon className={`w-5 h-5 ${colorClass}`} />
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">
        {count}
      </div>
      <div className="text-xs text-gray-500 mt-1 flex items-center">
        {activeOverviewCategory === title ? 'Click to hide details' : 'Click for details'}
        {activeOverviewCategory === title && <ChevronDownIcon className="w-3 h-3 ml-1" />}
      </div>
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {renderOverviewCard(
          'Workloads',
          CubeIcon,
          (state.analysis?.deployments.length || 0) + (state.analysis?.statefulSets.length || 0) + (state.analysis?.daemonSets.length || 0),
          [],
          'text-blue-500'
        )}

        {renderOverviewCard(
          'Network',
          GlobeAltIcon,
          (state.analysis?.services.length || 0) + (state.analysis?.ingresses.length || 0),
          [],
          'text-green-500'
        )}

        {renderOverviewCard(
          'Config & Secrets',
          ShieldCheckIcon,
          (state.analysis?.configMaps.length || 0) + (state.analysis?.secrets.length || 0) + (state.analysis?.serviceAccounts.length || 0),
          [],
          'text-purple-500'
        )}

        {renderOverviewCard(
          'Storage & Scaling',
          ServerStackIcon,
          (state.analysis?.pvcs.length || 0) + (state.analysis?.hpas.length || 0),
          [],
          'text-orange-500'
        )}
      </div>

      {/* Dynamic Details Section */}
      <div className={`transition-all duration-300 ease-in-out ${activeOverviewCategory ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 hidden'}`}>
        {activeOverviewCategory && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center">
                <DocumentTextIcon className="w-5 h-5 mr-2 text-gray-500" />
                {activeOverviewCategory} Details
              </h3>
              <button
                onClick={() => setActiveOverviewCategory(null)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeOverviewCategory === 'Workloads' && (
                <>
                  <ResourceList title="Deployments" items={state.analysis?.deployments} icon={CubeIcon} color="blue" />
                  <ResourceList title="StatefulSets" items={state.analysis?.statefulSets} icon={CubeIcon} color="indigo" />
                  <ResourceList title="DaemonSets" items={state.analysis?.daemonSets} icon={CubeIcon} color="cyan" />
                </>
              )}

              {activeOverviewCategory === 'Network' && (
                <>
                  <ResourceList title="Services" items={state.analysis?.services} icon={GlobeAltIcon} color="green" />
                  <ResourceList title="Ingresses" items={state.analysis?.ingresses} icon={GlobeAltIcon} color="emerald" />
                </>
              )}

              {activeOverviewCategory === 'Config & Secrets' && (
                <>
                  <ResourceList title="ConfigMaps" items={state.analysis?.configMaps} icon={DocumentTextIcon} color="yellow" />
                  <ResourceList title="Secrets" items={state.analysis?.secrets} icon={ShieldCheckIcon} color="red" />
                  <ResourceList title="ServiceAccounts" items={state.analysis?.serviceAccounts} icon={ShieldCheckIcon} color="purple" />
                </>
              )}

              {activeOverviewCategory === 'Storage & Scaling' && (
                <>
                  <ResourceList title="PVCs" items={state.analysis?.pvcs} icon={ServerStackIcon} color="orange" />
                  <ResourceList title="HPAs" items={state.analysis?.hpas} icon={ServerStackIcon} color="pink" />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const ResourceList = ({ title, items, icon: Icon, color }: { title: string, items: string[], icon: any, color: string }) => {
    if (!items || items.length === 0) return null;

    // Map color names to Tailwind classes
    const colorClasses: Record<string, string> = {
      blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-100 dark:border-blue-800',
      green: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 border-green-100 dark:border-green-800',
      purple: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 border-purple-100 dark:border-purple-800',
      orange: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300 border-orange-100 dark:border-orange-800',
      red: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border-red-100 dark:border-red-800',
      indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800',
      yellow: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300 border-yellow-100 dark:border-yellow-800',
      pink: 'bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-300 border-pink-100 dark:border-pink-800',
      cyan: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300 border-cyan-100 dark:border-cyan-800',
      emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800',
    };

    return (
      <div className="flex flex-col mb-4 last:mb-0">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
          <Icon className="w-4 h-4 mr-2 opacity-75" />
          {title}
          <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
            {items.length}
          </span>
        </h4>
        <div className="flex flex-wrap gap-2">
          {items.map((item, idx) => (
            <div
              key={idx}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border shadow-sm flex items-center ${colorClasses[color] || colorClasses.blue}`}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderLintResult = () => {
    if (!state.lintResult) return <div className="text-gray-500">No linting results available.</div>;

    return (
      <div className="space-y-4">
        <div className={`p-4 rounded-lg border ${state.lintResult.success ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'}`}>
          <div className="flex items-center">
            {state.lintResult.success ? (
              <CheckCircleIcon className="w-5 h-5 text-green-500 mr-2" />
            ) : (
              <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mr-2" />
            )}
            <h3 className={`font-medium ${state.lintResult.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
              {state.lintResult.success ? 'Linting Passed' : 'Linting Failed'}
            </h3>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
          <pre className="text-sm font-mono text-gray-300 whitespace-pre-wrap">
            {state.lintResult.output || state.lintResult.error}
          </pre>
        </div>
      </div>
    );
  };

  const handleFileSelect = (file: any) => {
    setSelectedFilePath(file.path);
    setSelectedFileContent(file.content);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 relative">


      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <CubeIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {state.chartMetadata?.name || 'Helm Chart Analyzer'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {state.chartMetadata?.description || 'Select a chart to analyze'}
              </p>
            </div>
          </div>
          <button
            onClick={handleSelectChart}
            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <FolderOpenIcon className="w-5 h-5 mr-2" />
            Select Chart
          </button>
        </div>
      </div>

      {state.error && (
        <div className="m-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center text-red-700 dark:text-red-300">
          <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
          {state.error}
        </div>
      )}

      {state.isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : state.chartPath ? (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Tabs */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4">
            <div className="flex space-x-4">
              {[
                { id: 'overview', label: 'Overview', icon: CubeIcon },
                { id: 'lint', label: 'Linting', icon: CheckCircleIcon },
                { id: 'files', label: 'Files', icon: DocumentTextIcon },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setState(prev => ({ ...prev, activeTab: tab.id as any }))}
                  className={`flex items-center px-4 py-3 border-b-2 font-medium text-sm transition-colors ${state.activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                >
                  <tab.icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            {state.activeTab === 'overview' && renderOverview()}
            {state.activeTab === 'lint' && renderLintResult()}
            {state.activeTab === 'files' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                  <div className="p-3 border-b border-gray-200 dark:border-gray-700 font-medium bg-gray-50 dark:bg-gray-900/50">
                    Chart Files
                  </div>
                  <div className="flex-1 overflow-auto p-2">
                    <div
                      className={`flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer text-sm ${selectedFilePath === 'values.yaml' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}
                      onClick={() => handleFileSelect({ path: 'values.yaml', content: state.values })}
                    >
                      <DocumentTextIcon className="w-4 h-4 mr-2" />
                      values.yaml
                    </div>
                    {state.templates.map((file, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer text-sm ${selectedFilePath === file.path ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}
                        onClick={() => handleFileSelect(file)}
                      >
                        <DocumentTextIcon className="w-4 h-4 mr-2" />
                        {file.path}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                  <div className="p-3 border-b border-gray-200 dark:border-gray-700 font-medium bg-gray-50 dark:bg-gray-900/50 flex justify-between">
                    <span>File Content: {selectedFilePath}</span>
                  </div>
                  <div className="flex-1">
                    <MonacoEditor
                      value={selectedFileContent}
                      language="yaml"
                      theme={theme === 'dark' ? 'vs-dark' : 'light'}
                      readOnly
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
          <CubeIcon className="w-24 h-24 mb-4 text-gray-300 dark:text-gray-600" />
          <h2 className="text-xl font-medium mb-2">No Chart Selected</h2>
          <p className="mb-6">Select a Helm chart directory to begin analysis</p>
          <button
            onClick={handleSelectChart}
            className="flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-lg"
          >
            <FolderOpenIcon className="w-5 h-5 mr-2" />
            Select Chart Directory
          </button>
        </div>
      )}
    </div>
  );
};

export default HelmChart;