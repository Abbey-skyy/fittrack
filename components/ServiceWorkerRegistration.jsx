'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then((reg) => {
          console.log('[SW] Registered, scope:', reg.scope);
          // Check for updates every time the app loads
          reg.update();
        })
        .catch((err) => console.error('[SW] Registration failed:', err));
    }
  }, []);

  return null;
}
