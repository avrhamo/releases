import React, { useState, useCallback } from 'react';
import { ChevronLeftIcon, PlusIcon } from '@heroicons/react/24/outline';

interface TopicSelectorProps {
  topics: string[];
  selectedTopic?: string;
  onTopicSelect: (topic: string, groupId?: string) => void;
  onTopicCreate: (topic: string, partitions: number, replicationFactor: number) => Promise<void>;
  onBack: () => void;
}

export const TopicSelector: React.FC<TopicSelectorProps> = ({
  topics,
  selectedTopic,
  onTopicSelect,
  onTopicCreate,
  onBack
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    partitions: 1,
    replicationFactor: 1
  });
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateTopic = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;

    setIsCreating(true);
    try {
      await onTopicCreate(createForm.name.trim(), createForm.partitions, createForm.replicationFactor);
      setCreateForm({ name: '', partitions: 1, replicationFactor: 1 });
      setShowCreateForm(false);
    } finally {
      setIsCreating(false);
    }
  }, [createForm, onTopicCreate]);

  const handleTopicClick = useCallback((topic: string) => {
    onTopicSelect(topic);
  }, [onTopicSelect]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5 mr-2" />
          Back
        </button>
        
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Select Topic
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Choose an existing topic or create a new one
          </p>
        </div>

        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 transition-colors"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Create Topic
        </button>
      </div>

      {/* Create Topic Form */}
      {showCreateForm && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
            Create New Topic
          </h4>
          
          <form onSubmit={handleCreateTopic} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="topicName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Topic Name
                </label>
                <input
                  type="text"
                  id="topicName"
                  value={createForm.name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                  placeholder="my-topic"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="partitions" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Partitions
                </label>
                <input
                  type="number"
                  id="partitions"
                  min="1"
                  value={createForm.partitions}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, partitions: parseInt(e.target.value) || 1 }))}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                />
              </div>
              
              <div>
                <label htmlFor="replicationFactor" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Replication Factor
                </label>
                <input
                  type="number"
                  id="replicationFactor"
                  min="1"
                  value={createForm.replicationFactor}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, replicationFactor: parseInt(e.target.value) || 1 }))}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating || !createForm.name.trim()}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </>
                ) : (
                  'Create Topic'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Topics List */}
      <div>
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
          Available Topics ({topics.length})
        </h4>
        
        {topics.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8V4a1 1 0 00-1-1H7a1 1 0 00-1 1v1m8 0V4a1 1 0 00-1-1H9a1 1 0 00-1 1v1m0 0H6a2 2 0 00-2 2v6a2 2 0 002 2h2m0 0h8m0 0h2a2 2 0 002-2V9a2 2 0 00-2-2h-2M9 6h6" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              No topics found
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by creating a new topic.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900"
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                Create your first topic
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic) => (
              <div
                key={topic}
                className={`relative rounded-lg border p-6 cursor-pointer transition-all duration-200 hover:shadow-md ${
                  selectedTopic === topic
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50 ring-2 ring-blue-500'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 bg-white dark:bg-gray-800'
                }`}
                onClick={() => handleTopicClick(topic)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {topic}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Click to select
                    </p>
                  </div>
                  
                  {selectedTopic === topic && (
                    <div className="flex-shrink-0 ml-4">
                      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedTopic && (
        <div className="flex justify-center pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => handleTopicClick(selectedTopic)}
            className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-900 transition-colors"
          >
            Continue with "{selectedTopic}"
            <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}; 