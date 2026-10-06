import React from 'react';import {createRoot} from 'react-dom/client';import App from './App.jsx';import './style.css';
import ClientSessionBoundary from '../ClientSessionBoundary.jsx';
createRoot(document.getElementById('root')).render(<ClientSessionBoundary><App/></ClientSessionBoundary>);
