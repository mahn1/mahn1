import React, { useEffect, useState } from 'react';
import { Composition, continueRender, delayRender } from 'remotion';
import { PisaVideo } from './Video';
import { DURATION } from './world/palette';
import { VIDEO } from './theme';
import { ensureFonts } from './fonts';

const FontGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [handle] = useState(() => delayRender('Загрузка шрифтов Montserrat'));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureFonts()
      .catch(() => undefined)
      .then(() => {
        setReady(true);
        continueRender(handle);
      });
  }, [handle]);

  if (!ready) return null;
  return <>{children}</>;
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="PisaRu"
    component={() => (
      <FontGate>
        <PisaVideo />
      </FontGate>
    )}
    durationInFrames={DURATION}
    fps={VIDEO.fps}
    width={VIDEO.width}
    height={VIDEO.height}
  />
);
