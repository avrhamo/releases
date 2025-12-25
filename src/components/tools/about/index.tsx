import React from 'react';
import { BaseToolProps } from '../types';
import {
  HeartIcon,
  CodeBracketIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  CpuChipIcon,
  UserGroupIcon,
  SparklesIcon,
  RocketLaunchIcon,
  CheckCircleIcon,
  StarIcon,
} from '@heroicons/react/24/outline';

const About: React.FC<BaseToolProps> = () => {
  const features = [
    {
      icon: CodeBracketIcon,
      title: 'Developer Tools',
      description: 'Comprehensive suite of development utilities including Base64, BSON, JWT, and more'
    },
    {
      icon: ShieldCheckIcon,
      title: 'Security First',
      description: 'RSA key generation, Keytab management, and Helm secrets encryption'
    },
    {
      icon: GlobeAltIcon,
      title: 'API Testing',
      description: 'Advanced API testing with MongoDB integration and comprehensive request builders'
    },
    {
      icon: CpuChipIcon,
      title: 'Performance Optimized',
      description: 'Built with modern web technologies for lightning-fast performance'
    },
    {
      icon: UserGroupIcon,
      title: 'Developer Experience',
      description: 'Intuitive interface designed by developers, for developers'
    },
    {
      icon: SparklesIcon,
      title: 'Always Evolving',
      description: 'Continuously updated with new features and improvements'
    }
  ];

  const techStack = [
    { name: 'React', version: '18.x', description: 'Modern UI framework' },
    { name: 'TypeScript', version: '5.x', description: 'Type-safe development' },
    { name: 'Vite', version: '5.x', description: 'Lightning-fast build tool' },
    { name: 'Tailwind CSS', version: '3.x', description: 'Utility-first CSS framework' },
    { name: 'Monaco Editor', version: '0.45.x', description: 'VS Code editor integration' },
    { name: 'Electron', version: '28.x', description: 'Cross-platform desktop app' },
  ];

  const acknowledgments = [
    'Monaco Editor team for the excellent code editor',
    'Tailwind CSS for the beautiful styling framework',
    'React and TypeScript communities for the amazing ecosystem',
    'Heroicons for the beautiful icon set',
    'All the open-source contributors who make projects like this possible',
    'The developer community for feedback and feature requests'
  ];

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
              <RocketLaunchIcon className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
            API Workspace
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            The ultimate developer toolkit for API testing, data transformation, and security operations
          </p>
          <div className="mt-6 flex items-center justify-center space-x-6">
            <div className="flex items-center text-gray-600 dark:text-gray-300">
              <span className="text-sm font-medium">Version 1.0.0</span>
            </div>
            <div className="flex items-center text-gray-600 dark:text-gray-300">
              <HeartIcon className="w-4 h-4 mr-1 text-red-500" />
              <span className="text-sm">Made with love</span>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
            Powerful Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <feature.icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white ml-3">
                    {feature.title}
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Tech Stack */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
            Built With Modern Technology
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {techStack.map((tech, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {tech.name}
                  </h4>
                  <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                    {tech.version}
                  </span>
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  {tech.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Mission Statement */}
        <div className="mb-16">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white">
            <h2 className="text-3xl font-bold mb-4 text-center">Our Mission</h2>
            <p className="text-lg text-center max-w-4xl mx-auto leading-relaxed">
              To provide developers with a comprehensive, offline-first toolkit that streamlines API testing,
              data transformation, and security operations. We believe in creating tools that enhance productivity
              while maintaining the highest standards of security and performance.
            </p>
          </div>
        </div>

        {/* Key Highlights */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
            Why Choose API Workspace?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-start">
                <CheckCircleIcon className="w-6 h-6 text-green-500 mr-3 mt-0.5" />
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">100% Offline</h4>
                  <p className="text-gray-600 dark:text-gray-300">Works completely offline - perfect for secure environments</p>
                </div>
              </div>
              <div className="flex items-start">
                <CheckCircleIcon className="w-6 h-6 text-green-500 mr-3 mt-0.5" />
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Privacy First</h4>
                  <p className="text-gray-600 dark:text-gray-300">Your data never leaves your machine</p>
                </div>
              </div>
              <div className="flex items-start">
                <CheckCircleIcon className="w-6 h-6 text-green-500 mr-3 mt-0.5" />
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Cross-Platform</h4>
                  <p className="text-gray-600 dark:text-gray-300">Available on Windows, macOS, and Linux</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start">
                <CheckCircleIcon className="w-6 h-6 text-green-500 mr-3 mt-0.5" />
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Developer-Centric</h4>
                  <p className="text-gray-600 dark:text-gray-300">Built by developers, for developers</p>
                </div>
              </div>
              <div className="flex items-start">
                <CheckCircleIcon className="w-6 h-6 text-green-500 mr-3 mt-0.5" />
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Regular Updates</h4>
                  <p className="text-gray-600 dark:text-gray-300">Continuously improved with new features</p>
                </div>
              </div>
              <div className="flex items-start">
                <CheckCircleIcon className="w-6 h-6 text-green-500 mr-3 mt-0.5" />
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Free & Open Source</h4>
                  <p className="text-gray-600 dark:text-gray-300">Always free to use and modify</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Acknowledgments */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
            Acknowledgments
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg">
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-6 text-center">
              API Workspace wouldn't be possible without the incredible work of these projects and communities:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {acknowledgments.map((acknowledgment, index) => (
                <div key={index} className="flex items-center">
                  <StarIcon className="w-5 h-5 text-yellow-500 mr-3" />
                  <span className="text-gray-700 dark:text-gray-300">{acknowledgment}</span>
                </div>
              ))}
            </div>
          </div>
        </div>



        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700 text-center">
          <p className="text-gray-600 dark:text-gray-300">
            © 2024 API Workspace. Made with ❤️ by developers, for developers.
          </p>
        </div>
      </div>
    </div>
  );
};

export default About; 