import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// Register the service worker (offline app shell). Done lazily so it never blocks first paint.
if ('serviceWorker' in navigator && import.meta.env.PROD && !import.meta.env.VITE_DEMO) {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}
