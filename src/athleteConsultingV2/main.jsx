import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import Capture from './Capture.jsx';
import './style.css';
createRoot(document.getElementById('root')).render(new URLSearchParams(location.search).get('capture') === '1' ? <Capture/> : <App/>);
