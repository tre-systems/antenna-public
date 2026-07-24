import './sentry';
import { render } from 'preact';
import { App } from './App';
import { registerAppServiceWorker } from './pwa-registration';
import './styles.css';

const root = document.getElementById('app');
if (!root) throw new Error('#app root element missing');
render(<App />, root);
registerAppServiceWorker();
