import Layout from './components/layout/Layout';
import { useTheme } from './hooks/useTheme';
import { useLoadingScreen } from './hooks/useLoadingScreen';
import { useState, useEffect, Suspense, useRef } from 'react';
import { Tab } from '@headlessui/react';
import {
  XMarkIcon
} from '@heroicons/react/24/outline';
import React from 'react';
import { useTabShortcuts } from './hooks/useTabShortcuts';
import WelcomePage from './components/common/WelcomePage';

import { TOOL_COMPONENTS, TOOL_LABELS, TOOL_ICONS, DEFAULT_TOOL_STATES } from './config/toolRegistry';

interface Tab {
  id: string;
  toolId: string;
  label: string;
}

interface ToolState {
  [key: string]: any;  // Each tool can have its own state shape
}

interface TabState {
  [tabId: string]: ToolState;  // Map of tab ID to its tool state
}

const App: React.FC = () => {
  const { currentTool } = useTheme();
  const [tabs, setTabs] = useState<Tab[]>(() => {
    const savedTabs = localStorage.getItem('tabs');
    return savedTabs ? JSON.parse(savedTabs) : [{ id: 'default', toolId: 'base64', label: 'Base64' }];
  });

  const [selectedTabIndex, setSelectedTabIndex] = useState<number>(() => {
    const savedIndex = localStorage.getItem('selectedTabIndex');
    return savedIndex ? parseInt(savedIndex, 10) : 0;
  });

  const [tabStates, setTabStates] = useState<TabState>(() => {
    const savedStates = localStorage.getItem('tabStates');
    return savedStates ? JSON.parse(savedStates) : {};
  });

  const [appReady, setAppReady] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Control loading screen
  useLoadingScreen(appReady);

  // Initialize app ready state after component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppReady(true);
      // Check for welcome page
      const welcomeSeen = localStorage.getItem('welcomeSeen');
      if (!welcomeSeen) {
        setShowWelcome(true);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Save tabs and selected index to localStorage
  useEffect(() => {
    localStorage.setItem('tabs', JSON.stringify(tabs));
    localStorage.setItem('selectedTabIndex', selectedTabIndex.toString());
    localStorage.setItem('tabStates', JSON.stringify(tabStates));
  }, [tabs, selectedTabIndex, tabStates]);

  const openNewTab = (toolId: string) => {
    // Cleanup previous tool state if needed
    const currentTab = tabs[selectedTabIndex];
    if (currentTab) {
      cleanupToolState(currentTab.toolId);
    }

    const newTab: Tab = {
      id: `${toolId}-${Date.now()}`,
      toolId,
      label: TOOL_LABELS[toolId],
    };
    setTabs(prev => [...prev, newTab]);
    setSelectedTabIndex(tabs.length);

    // Initialize state for the new tab if it doesn't exist
    setTabStates(prev => {
      if (!prev[newTab.id]) {
        // Ensure DEFAULT_TOOL_STATES[toolId] exists before cloning
        const defaultStateForTool = DEFAULT_TOOL_STATES[toolId];
        const initialState = defaultStateForTool
          ? JSON.parse(JSON.stringify(defaultStateForTool))
          : {};

        return {
          ...prev,
          [newTab.id]: {
            ...initialState,
            lastUpdated: Date.now()
          }
        };
      }
      return prev;
    });
  };

  // Add cleanup function
  const cleanupToolState = async (toolId: string) => {
    switch (toolId) {
      case 'kafka':
        try {
          // Disconnect from Kafka if connected
        } catch (error) {
          // Connection cleanup error - no logging needed
        }
        break;
      case 'api-tester':
        // Add any API tester cleanup if needed
        break;
      // Add other tool cleanup cases as needed
    }
  };

  // Update tab selection to include cleanup
  const handleTabChange = async (index: number) => {
    const currentTab = tabs[selectedTabIndex];
    if (currentTab) {
      await cleanupToolState(currentTab.toolId);
    }
    setSelectedTabIndex(index);
  };

  const closeTab = (index: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const tabToClose = tabs[index];
    setTabs(prev => prev.filter((_, i) => i !== index));
    setTabStates(prev => {
      const newStates = { ...prev };
      delete newStates[tabToClose.id];
      return newStates;
    });
    if (selectedTabIndex >= index && selectedTabIndex > 0) {
      setSelectedTabIndex(prev => prev - 1);
    }
    setContextMenu(null);
  };

  const closeOtherTabs = (index: number) => {
    const tabKeep = tabs[index];
    setTabs([tabKeep]);
    // Optionally cleanup states of closed tabs, but for simplicity we can keep states or just filter
    // To be clean:
    setTabStates(prev => {
      const newState: TabState = {};
      if (prev[tabKeep.id]) newState[tabKeep.id] = prev[tabKeep.id];
      return newState;
    });
    setSelectedTabIndex(0);
    setContextMenu(null);
  };

  const closeAllTabs = () => {
    setTabs([]);
    setTabStates({});
    setSelectedTabIndex(0); // Effectively no tabs
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, index });
  };

  const handleToolStateChange = (tabId: string, newState: Partial<ToolState>) => {
    setTabStates(prev => {
      const currentToolIdForTab = tabs.find(t => t.id === tabId)?.toolId;

      // Enhanced logging for api-tester state changes
      if (currentToolIdForTab === 'api-tester') {
        const apiTesterDefault = DEFAULT_TOOL_STATES['api-tester'];
        if (newState &&
          newState.step === apiTesterDefault.step &&
          JSON.stringify(newState.connectionConfig) === JSON.stringify(apiTesterDefault.connectionConfig) &&
          JSON.stringify(newState.curlConfig) === JSON.stringify(apiTesterDefault.curlConfig) &&
          JSON.stringify(newState.testConfig) === JSON.stringify(apiTesterDefault.testConfig) &&
          JSON.stringify(newState.availableFields) === JSON.stringify(apiTesterDefault.availableFields)) {
          return prev;
        }
      }

      const currentState = prev[tabId] || {};
      const updatedState = {
        ...currentState,
        ...newState,
        lastUpdated: Date.now()
      };
      const nextState = {
        ...prev,
        [tabId]: updatedState
      };
      return nextState;
    });
  };

  const renderTool = (toolId: string, tabId: string) => {
    const ToolComponent = TOOL_COMPONENTS[toolId];
    if (!ToolComponent) {
      return null;
    }

    const defaultStateForTool = DEFAULT_TOOL_STATES[toolId];
    const initialStateFallback = defaultStateForTool
      ? JSON.parse(JSON.stringify(defaultStateForTool))
      : {};
    const currentState = tabStates[tabId] || initialStateFallback;

    return (
      <Suspense fallback={
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading {TOOL_LABELS[toolId]}...</p>
          </div>
        </div>
      }>
        <ToolComponent
          key={tabId}
          state={currentState}
          setState={(newState: Partial<ToolState>) => handleToolStateChange(tabId, newState)}
        />
      </Suspense>
    );
  };

  // Add useTabShortcuts hook
  useTabShortcuts({
    tabs,
    selectedTabIndex,
    onTabChange: handleTabChange,
    onCloseTab: (index) => closeTab(index, new MouseEvent('click') as any),
  });

  // Helper: open or select tab for a tool
  const openOrSelectTab = (toolId: string) => {
    const existingIndex = tabs.findIndex(tab => tab.toolId === toolId);
    if (existingIndex !== -1) {
      setSelectedTabIndex(existingIndex);
    } else {
      openNewTab(toolId);
    }
  };

  return (
    <>
      <WelcomePage isOpen={showWelcome} onClose={() => setShowWelcome(false)} />
      <Layout
        currentTool={currentTool}
        setCurrentTool={openOrSelectTab}
        tabBar={
          <Tab.Group selectedIndex={selectedTabIndex} onChange={handleTabChange} as="div" className="h-full flex flex-col flex-1 min-h-0">
            <Tab.List className="flex-none flex space-x-1 border-b border-gray-200 dark:border-gray-700">
              {tabs.map((tab, index) => (
                <Tab
                  key={tab.id}
                  as="div"
                  onContextMenu={(e) => handleContextMenu(e, index)}
                  className={({ selected }) =>
                    `group relative flex items-center px-4 py-2 text-sm font-medium focus:outline-none cursor-pointer select-none
                  ${selected
                      ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`
                  }
                >
                  <div className="flex items-center">
                    {TOOL_ICONS[tab.toolId] && React.createElement(TOOL_ICONS[tab.toolId], { className: "w-4 h-4" })}
                    <span className="ml-2">{tab.label}</span>
                    <button
                      onClick={(e) => closeTab(index, e)}
                      className="ml-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none"
                      title={`Close ${tab.label} tab`}
                      aria-label={`Close ${tab.label} tab`}
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                </Tab>
              ))}
            </Tab.List>
            <Tab.Panels className="flex-1 min-h-0 h-full">
              {tabs.map(tab => (
                <Tab.Panel
                  key={tab.id}
                  className="h-full w-full overflow-y-auto"
                >
                  {renderTool(tab.toolId, tab.id)}
                </Tab.Panel>
              ))}
            </Tab.Panels>
          </Tab.Group>
        }
      >
        <div className="hidden" />
      </Layout>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-white dark:bg-gray-800 shadow-lg rounded-md border border-gray-200 dark:border-gray-700 py-1 z-50 text-sm"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
            onClick={() => closeTab(contextMenu.index)}
          >
            Close Tab
          </button>
          <button
            className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
            onClick={() => closeOtherTabs(contextMenu.index)}
          >
            Close Others
          </button>
          <button
            className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 dark:text-red-400"
            onClick={closeAllTabs}
          >
            Close All
          </button>
        </div>
      )}
    </>
  );
};

export default App;