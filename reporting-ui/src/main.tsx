import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './style.css';

const root = document.getElementById('root');
if (!root) throw new Error('Reporting workbench root is missing.');
createRoot(root).render(<App />);
