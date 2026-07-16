import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/global.scss';
import logoImage from '@/assets/logo.jpg';
import { initializeI18n } from '@/i18n';
import App from './App.tsx';

document.title = 'CLI Proxy API Management Center';
document.documentElement.setAttribute('translate', 'no');
document.documentElement.classList.add('notranslate');

const faviconEl = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
if (faviconEl) {
  faviconEl.href = logoImage;
  faviconEl.type = 'image/jpeg';
} else {
  const newFavicon = document.createElement('link');
  newFavicon.rel = 'icon';
  newFavicon.type = 'image/jpeg';
  newFavicon.href = logoImage;
  document.head.appendChild(newFavicon);
}

async function bootstrap() {
  await initializeI18n();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void bootstrap();
