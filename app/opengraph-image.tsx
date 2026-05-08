import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'CPCProfit — dáta pre obchodníkov s vozidlami';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(135deg, #0a0e1a 0%, #1a2540 50%, #0a0e1a 100%)',
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #4f7aef, #6db3f5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
              fontWeight: 800,
            }}
          >
            C
          </div>
          <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: -1 }}>CPCProfit</div>
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            textAlign: 'center',
            maxWidth: 900,
            lineHeight: 1.1,
            letterSpacing: -2,
          }}
        >
          Predávajte autá so{' '}
          <span style={{ color: '#6db3f5' }}>zaručenou maržou</span>.
        </div>
        <div
          style={{
            fontSize: 28,
            color: '#94a3b8',
            marginTop: 32,
            textAlign: 'center',
            maxWidth: 800,
          }}
        >
          Reálne ceny zo SK trhu · AI insights · Smart watchlist
        </div>
      </div>
    ),
    size,
  );
}
