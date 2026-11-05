import { createRoot } from 'react-dom/client';
import App from './AuthApp';
import './styles.css';
import { readRecoveryLocation } from './recovery';

const initialRecovery = readRecoveryLocation(window);
createRoot(document.getElementById('root')!).render(<App initialRecovery={initialRecovery} />);
