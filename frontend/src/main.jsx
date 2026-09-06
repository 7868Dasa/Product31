import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { I18nProvider } from './i18n/index.jsx';
import { StoreProvider } from './store.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <I18nProvider>
          <App />
        </I18nProvider>
      </StoreProvider>
    </BrowserRouter>
  </StrictMode>,
);
