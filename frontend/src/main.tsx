import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { Web3Provider } from './providers/Web3Provider';
import { ApiProvider } from './providers/ApiProvider';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found');
}

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <Web3Provider>
        <ApiProvider>
          <App />
        </ApiProvider>
      </Web3Provider>
    </BrowserRouter>
  </StrictMode>,
);
