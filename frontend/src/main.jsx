import React from 'react'
import ReactDOM from 'react-dom/client'

// CRITICAL: Load polyfills FIRST before any other imports
import { Buffer } from 'buffer'
import process from 'process'
import { EventEmitter } from 'events'

// Make them globally available
window.Buffer = Buffer
window.process = process
window.global = globalThis
if (!window.EventEmitter) window.EventEmitter = EventEmitter

// Now we can safely import the app
import App from './App.jsx'
import './App.css'

console.log('🚀 AppEx Protocol starting...');
console.log('✅ Buffer:', typeof window.Buffer);
console.log('✅ process:', typeof window.process);
console.log('✅ global:', typeof window.global);

// Error handler for uncaught errors
window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
