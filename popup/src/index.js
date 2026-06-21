import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css'; // Import the main CSS file (Tailwind output)

// Force the dark theme (Applendium dark mirrors the landing-page hero). This is
// belt-and-suspenders alongside the `class="dark"` on <html> so the theme holds
// regardless of how the entry HTML is processed by the build.
if (typeof document !== 'undefined' && document.documentElement) {
  document.documentElement.classList.add('dark');
}

try {
  // Opening the popup is treated as acknowledging the toolbar badge.
  if (typeof chrome !== 'undefined' && chrome.action?.setBadgeText) {
    chrome.action.setBadgeText({ text: '' });
  }
} catch (_) {
  // Ignore badge-clear failures so popup startup is never blocked.
}

// Find the root DOM element where the React app will be mounted
const container = document.getElementById('root');

// Create a root and render the App component wrapped in ErrorBoundary
if (container) {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
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
    console.error("Multiple React instances detected!");
  }
}
