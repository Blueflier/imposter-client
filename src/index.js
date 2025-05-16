import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css'; // Global styles
import App from './App';
import reportWebVitals from './web-vitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
<React.StrictMode>
<App />
</React.StrictMode>
);

reportWebVitals();