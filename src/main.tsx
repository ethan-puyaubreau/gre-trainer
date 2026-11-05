import 'katex/dist/katex.min.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';
import { startCloudSync } from './sync';
import { registerServiceWorker } from './sw-register';

// Ask the browser not to evict localStorage under storage pressure; a refusal is harmless.
void navigator.storage?.persist?.();
startCloudSync();
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
