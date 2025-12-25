import { useEffect } from 'react';

/**
 * Hook to control the initial loading screen
 * Call this in your main App component to hide the loading screen when ready
 */
export const useLoadingScreen = (isAppReady: boolean = true) => {
  useEffect(() => {
    if (isAppReady) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        const loading = document.getElementById('app-loading');
        if (loading && !loading.classList.contains('hide')) {
          loading.classList.add('hide');
          setTimeout(() => {
            loading.style.display = 'none';
          }, 500);
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isAppReady]);

  return {
    hideLoadingScreen: () => {
      const loading = document.getElementById('app-loading');
      if (loading) {
        loading.classList.add('hide');
        setTimeout(() => {
          loading.style.display = 'none';
        }, 500);
      }
    }
  };
}; 