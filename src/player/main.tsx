import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Player } from '@remotion/player';
import { PisaVideo } from '../Video';
import { DURATION } from '../world/palette';
import { VIDEO } from '../theme';

const App: React.FC = () => {
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    import('../fonts')
      .then(({ ensureFonts }) => ensureFonts())
      .catch(() => undefined)
      .finally(() => setFontsReady(true));
  }, []);

  const inputProps = useMemo(() => ({}), []);

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Пизанская башня</h1>
        <p style={styles.subtitle}>
          Тестовая 2D-анимация на Remotion · {DURATION / VIDEO.fps} секунд · {VIDEO.width}×{VIDEO.height}
        </p>
      </header>

      <div style={styles.playerWrap}>
        {fontsReady ? (
          <Player
            component={PisaVideo}
            inputProps={inputProps}
            durationInFrames={DURATION}
            fps={VIDEO.fps}
            compositionWidth={VIDEO.width}
            compositionHeight={VIDEO.height}
            style={{ width: '100%', height: '100%' }}
            controls
            loop
            autoPlay
            clickToPlay
            doubleClickToFullscreen
            acknowledgeRemotionLicense
          />
        ) : (
          <div style={styles.loading}>Загрузка шрифтов…</div>
        )}
      </div>

      <footer style={styles.footer}>
        <code style={styles.code}>npm run render</code> — соберёт MP4 в <code style={styles.code}>out/</code>
      </footer>
    </main>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    margin: 0,
    padding: '28px 16px 40px',
    boxSizing: 'border-box',
    background: 'radial-gradient(120% 80% at 50% 0%, #24304a 0%, #0d1117 55%, #07090d 100%)',
    color: '#e6edf3',
    fontFamily: 'Montserrat, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 22,
  },
  header: { textAlign: 'center' },
  title: {
    margin: 0,
    fontSize: 'clamp(24px, 4vw, 40px)',
    fontWeight: 900,
    letterSpacing: '-0.01em',
    color: '#fff',
  },
  subtitle: { margin: '8px 0 0', fontSize: 15, color: '#9fb0c8' },
  playerWrap: {
    width: 'min(92vw, 430px)',
    aspectRatio: `${VIDEO.width} / ${VIDEO.height}`,
    borderRadius: 18,
    overflow: 'hidden',
    boxShadow: '0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)',
    background: '#0b0e14',
    position: 'relative',
  },
  loading: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    color: '#9fb0c8',
    fontSize: 14,
  },
  footer: { fontSize: 13, color: '#7d8ba1', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  code: {
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
    padding: '3px 7px',
    fontSize: 12,
  },
};

createRoot(document.getElementById('root')!).render(<App />);
