import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App'
import './styles.css'
import './styles/animations.css'

console.log('Main.tsx: Starting application...');

// Add global error handler
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

try {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })

  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    console.error('Root element not found!');
    document.body.innerHTML = '<h1>Error: Root element not found</h1>';
  } else {
    console.log('Root element found, creating React root...');
    
    const root = createRoot(rootElement);
    
    console.log('Rendering React app...');
    
    root.render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </React.StrictMode>
    );
    
    console.log('React app rendered successfully');
  }
} catch (error) {
  console.error('Error during app initialization:', error);
  document.body.innerHTML = `<h1>Error loading application</h1><pre>${error}</pre>`;
}