import { lazy, ComponentType } from 'react';

// Retry failed dynamic imports to handle deployment updates
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page_has_been_force_refreshed') || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page_has_been_force_refreshed', 'false');
      return component;
    } catch (error: any) {
      if (!pageHasAlreadyBeenForceRefreshed && error?.name === 'ChunkLoadError') {
        // Deployment occurred, force refresh to get new chunks
        window.sessionStorage.setItem('page_has_been_force_refreshed', 'true');
        window.location.reload();
        // Return empty component while reloading
        return { default: (() => null) as unknown as T };
      }

      // Let other errors bubble up
      throw error;
    }
  });
}