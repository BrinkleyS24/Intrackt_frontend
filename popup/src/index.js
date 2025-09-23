import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css'; // Import the main CSS file (Tailwind output)

// Import subscription service to ensure it's available globally
import './services/subscriptionService.js';

// Find the root DOM element where the React app will be mounted
const container = document.getElementById('root');

// Create a root and render the App component
if (container) {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
} else {
    console.error('Failed to find the root element to mount the React application.');
    // Optionally display a fallback message in the body
    document.body.innerHTML = '<div style="padding: 20px; text-align: center; color: red; font-family: sans-serif;">Error: Application failed to load. Root element not found.</div>';
}
if (typeof window !== "undefined") {
  window.__REACT_INSTANCE = window.__REACT_INSTANCE || React;
  if (window.__REACT_INSTANCE !== React) {
    console.error("🚨 Multiple React instances detected!");
  } else {
    console.log("✅ Single React instance.");
  }
}
