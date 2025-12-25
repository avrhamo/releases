import { FC, useState } from 'react';
import {
  CodeBracketIcon,
  KeyIcon,
  LockClosedIcon,
  CommandLineIcon,
  ClockIcon,
  DocumentTextIcon,
  CloudIcon,
  CubeTransparentIcon,
  XMarkIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FaceSmileIcon,
  DocumentDuplicateIcon,
  CodeBracketSquareIcon,
  DocumentMagnifyingGlassIcon,
  SwatchIcon,
  ExclamationTriangleIcon,
  HeartIcon,
  InformationCircleIcon,
  ServerIcon,
} from '@heroicons/react/24/outline';
import { useTheme } from '../../hooks/useTheme';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  currentTool: string;
  setCurrentTool: (tool: string) => void;
}

interface Tool {
  id: string;
  name: string;
  icon: any;
  description: string;
  disabled?: boolean;
  comingSoon?: boolean;
}

interface ToolGroup {
  group: string;
  id: string;
  tools: Tool[];
}

const groupedTools: ToolGroup[] = [
  {
    group: 'API & Network',
    id: 'api-network',
    tools: [
      {
        id: 'api-tester',
        name: 'API Tester',
        icon: CloudIcon,
        description: 'Test and monitor API endpoints with MongoDB integration'
      },
      {
        id: 'kafka',
        name: 'Kafka Tester',
        icon: CommandLineIcon,
        description: 'Produce and consume Kafka messages, manage topics, and monitor message flow'
      },
      {
        id: 'openapi-generator',
        name: 'OpenAPI Generator',
        icon: SwatchIcon,
        description: 'Generate OpenAPI/Swagger specifications from API definitions'
      },
    ],
  },
  {
    group: 'Data & Format',
    id: 'data-format',
    tools: [
      {
        id: 'base64',
        name: 'Base64',
        icon: CodeBracketIcon,
        description: 'Encode and decode Base64 strings'
      },
      {
        id: 'bson',
        name: 'BSON Tools',
        icon: CubeTransparentIcon,
        description: 'Work with BSON data format'
      },
      {
        id: 'regex',
        name: 'Regex',
        icon: DocumentTextIcon,
        description: 'Test and validate regular expressions'
      },
      {
        id: 'time',
        name: 'Time Units',
        icon: ClockIcon,
        description: 'Convert between different time units'
      },
      {
        id: 'size-units',
        name: 'Size Units',
        icon: ServerIcon,
        description: 'Convert between data storage sizes (bytes, KB, MB, GB, etc.)'
      },
      {
        id: 'text-compare',
        name: 'Text Compare',
        icon: DocumentMagnifyingGlassIcon,
        description: 'Compare and find differences between two text inputs'
      },
      {
        id: 'pojo-creator',
        name: 'POJO Creator',
        icon: CodeBracketSquareIcon,
        description: 'Generate Java classes from JSON input with various annotations'
      },
    ],
  },
  {
    group: 'Security & Auth',
    id: 'security-auth',
    tools: [
      {
        id: 'rsa',
        name: 'RSA',
        icon: LockClosedIcon,
        description: 'Generate and manage RSA keys'
      },
      {
        id: 'keytab',
        name: 'Keytab',
        icon: KeyIcon,
        description: 'Create and manage Kerberos keytabs'
      },
      {
        id: 'helm-chart',
        name: 'Helm Chart',
        icon: ShieldCheckIcon,
        description: 'Analyze and lint Helm charts'
      },
      {
        id: 'jwt',
        name: 'JWT Tools',
        icon: DocumentDuplicateIcon,
        description: 'Decode, verify, and work with JWT tokens'
      },
      {
        id: 'hash',
        name: 'Hash Generator',
        icon: ShieldCheckIcon,
        description: 'Generate secure hashes and HMACs for API signatures and data integrity'
      },
    ],
  },
  {
    group: 'Utilities',
    id: 'utilities',
    tools: [
      {
        id: 'port-killer',
        name: 'Port Killer',
        icon: ExclamationTriangleIcon,
        description: 'Find and kill processes using specific ports'
      },
    ],
  },
];

const Sidebar: FC<SidebarProps> = ({ isOpen, setIsOpen, currentTool, setCurrentTool }) => {
  const { theme, toggleTheme } = useTheme();
  // Collapsed by default as per user request
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  return (
    <div
      className={`
        fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
        bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg
        border-r border-gray-200 dark:border-gray-700
        flex flex-col
      `}
    >
      {/* Logo Area */}
      <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          API Workspace
        </span>
        <button
          onClick={() => setIsOpen(false)}
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Close sidebar"
          aria-label="Close sidebar"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation - Grouped */}
      <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
        {groupedTools.map((group) => (
          <div key={group.id} className="mb-2">
            <button
              onClick={() => toggleGroup(group.id)}
              className="flex items-center w-full px-2 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-300 focus:outline-none"
              aria-expanded={openGroups.includes(group.id) ? "true" : "false"}
              aria-label={`Toggle ${group.group} group`}
              title={`Toggle ${group.group} group`}
            >
              {openGroups.includes(group.id) ? (
                <ChevronDownIcon className="w-4 h-4 mr-2" aria-hidden="true" />
              ) : (
                <ChevronRightIcon className="w-4 h-4 mr-2" aria-hidden="true" />
              )}
              {group.group}
            </button>
            {openGroups.includes(group.id) && (
              <div className="space-y-1 ml-2 mt-1">
                {group.tools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => !tool.disabled && setCurrentTool(tool.id)}
                    disabled={tool.disabled}
                    className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl
                      transition-all duration-150 ease-in-out
                      ${tool.disabled
                        ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-60'
                        : currentTool === tool.id
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                      }
                      ${!tool.disabled ? 'focus:outline-none focus:ring-2 focus:ring-blue-500/40' : ''}
                      group relative`}
                    title={tool.disabled ? `${tool.description} (Coming Soon)` : tool.description}
                  >
                    <tool.icon className={`w-5 h-5 mr-3 ${!tool.disabled ? 'transition-transform group-hover:scale-110' : ''}`} />
                    <span className="truncate flex items-center">
                      {tool.name}
                      {tool.comingSoon && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded-full">
                          Coming Soon
                        </span>
                      )}
                    </span>
                    {!tool.disabled && (
                      <div className="absolute left-0 bottom-0 w-full h-1 bg-blue-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200 ease-out" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-2">
        <button
          onClick={toggleTheme}
          className="w-full px-4 py-3 text-sm font-medium rounded-xl
            transition-all duration-150 ease-in-out
            text-gray-600 dark:text-gray-300
            hover:bg-blue-50 dark:hover:bg-gray-700
            hover:text-blue-600 dark:hover:text-blue-400
            focus:outline-none focus:ring-2 focus:ring-blue-500/40
            flex items-center justify-center"
        >
          {theme === 'dark' ? '🌞 Light Mode' : '🌙 Dark Mode'}
        </button>
        <button
          onClick={() => setCurrentTool('waiting-room')}
          className="w-full px-4 py-3 text-sm font-medium rounded-xl
            transition-all duration-150 ease-in-out
            text-gray-600 dark:text-gray-300
            hover:bg-green-50 dark:hover:bg-gray-700
            hover:text-green-600 dark:hover:text-green-400
            focus:outline-none focus:ring-2 focus:ring-green-500/40
            flex items-center justify-center"
          title="Waiting Room: Play a game while you wait!"
        >
          <FaceSmileIcon className="w-5 h-5 mr-2" />
          Waiting Room
        </button>


        {/* About */}
        <button
          onClick={() => setCurrentTool('about')}
          className="w-full px-4 py-3 text-sm font-medium rounded-xl
            transition-all duration-150 ease-in-out
            text-gray-600 dark:text-gray-300
            hover:bg-purple-50 dark:hover:bg-gray-700
            hover:text-purple-600 dark:hover:text-purple-400
            focus:outline-none focus:ring-2 focus:ring-purple-500/40
            flex items-center justify-center"
          title="About API Workspace"
        >
          <InformationCircleIcon className="w-5 h-5 mr-2" />
          About
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
