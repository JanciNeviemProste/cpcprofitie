'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="sk">
      <body
        style={{
          background: '#0a0e1a',
          color: '#f1f5f9',
          fontFamily: 'system-ui, sans-serif',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
            Aplikácia narazila na neočakávanú chybu
          </h1>
          <p style={{ color: '#94a3b8', marginTop: 12, fontSize: 14, lineHeight: 1.6 }}>
            Tím už dostal upozornenie. Skúste obnoviť stránku, alebo nás kontaktujte na
            hello@cpcprofit.sk.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              background: '#4f7aef',
              color: 'white',
              border: 0,
              borderRadius: 8,
              padding: '10px 18px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Obnoviť
          </button>
        </div>
      </body>
    </html>
  );
}
