import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { XMarkIcon, RocketLaunchIcon, WrenchScrewdriverIcon, ShieldCheckIcon, HandRaisedIcon } from '@heroicons/react/24/outline';

interface WelcomePageProps {
    isOpen: boolean;
    onClose: () => void;
}

const WelcomePage: React.FC<WelcomePageProps> = ({ isOpen, onClose }) => {
    const [dontShowAgain, setDontShowAgain] = useState(false);

    const handleClose = () => {
        if (dontShowAgain) {
            localStorage.setItem('welcomeSeen', 'true');
        }
        onClose();
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={handleClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all border border-gray-200 dark:border-gray-700">
                                <div className="absolute top-4 right-4">
                                    <button
                                        onClick={handleClose}
                                        className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                                    >
                                        <XMarkIcon className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="text-center mb-8">
                                    <div className="mx-auto bg-blue-100 dark:bg-blue-900/30 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                                        <RocketLaunchIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <Dialog.Title
                                        as="h3"
                                        className="text-3xl font-bold leading-6 text-gray-900 dark:text-white"
                                    >
                                        Welcome to DevToolbox
                                    </Dialog.Title>
                                    <p className="mt-3 text-gray-500 dark:text-gray-400">
                                        Your all-in-one desktop companion for development, DevOps, and security tasks.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <WrenchScrewdriverIcon className="w-8 h-8 text-indigo-500 mb-3" />
                                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Developer Tools</h4>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Formatters, converters, and generators to speed up your daily workflow.
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <ShieldCheckIcon className="w-8 h-8 text-green-500 mb-3" />
                                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Security Utils</h4>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Hash generators, RSA keys, and safe encoding utilities.
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <HandRaisedIcon className="w-8 h-8 text-orange-500 mb-3" />
                                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Take a Break</h4>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Visit the Waiting Room for quick games when compiling takes too long.
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 dark:border-gray-700 pt-6">
                                    <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={dontShowAgain}
                                            onChange={(e) => setDontShowAgain(e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-gray-100 dark:bg-gray-700 dark:border-gray-600"
                                        />
                                        <span>Don't show this again</span>
                                    </label>

                                    <button
                                        type="button"
                                        className="inline-flex justify-center rounded-lg border border-transparent bg-blue-600 px-8 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors w-full sm:w-auto"
                                        onClick={handleClose}
                                    >
                                        Get Started
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default WelcomePage;
