import React from 'react';
import type { Palette } from '../world/palette';
import { VIDEO } from '../theme';

/** Небо, солнце, облака, холмы, трава и дорожка — плоская «мультяшная» сцена. */

export const GROUND_Y = 1440;

/** запас по краям: нужен, когда камера отъезжает */
const BLEED = 620;

export const Cloud: React.FC<{
  x: number;
  y: number;
  s?: number;
  color: string;
  opacity?: number;
}> = ({ x, y, s = 1, color, opacity = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity}>
    <ellipse cx={0} cy={0} rx={78} ry={34} fill={color} />
    <ellipse cx={-52} cy={12} rx={48} ry={24} fill={color} />
    <ellipse cx={50} cy={10} rx={54} ry={26} fill={color} />
    <ellipse cx={6} cy={-20} rx={44} ry={28} fill={color} />
  </g>
);

export const Backdrop: React.FC<{
  pal: Palette;
  cloudOffset?: number;
  sunX?: number;
  sunY?: number;
  sunR?: number;
  showPath?: boolean;
  showWater?: boolean;
  /** 0..1 — насколько просел грунт слева (для сцены с наклоном) */
  groundTilt?: number;
}> = ({
  pal,
  cloudOffset = 0,
  sunX = 800,
  sunY = 640,
  sunR = 1,
  showPath = true,
  showWater = false,
  groundTilt = 0,
}) => (
  <svg
    width={VIDEO.width}
    height={VIDEO.height}
    viewBox={`0 0 ${VIDEO.width} ${VIDEO.height}`}
    style={{ position: 'absolute', inset: 0 }}
  >
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={pal.skyTop} />
        <stop offset="62%" stopColor={pal.skyBottom} />
      </linearGradient>
    </defs>

    <rect x={-BLEED} y={-BLEED} width={VIDEO.width + BLEED * 2} height={VIDEO.height + BLEED * 2} fill="url(#sky)" />

    {/* солнце */}
    <circle cx={sunX} cy={sunY} r={170 * sunR} fill={pal.sun} opacity={0.25} />
    <circle cx={sunX} cy={sunY} r={108 * sunR} fill={pal.sun} opacity={0.6} />
    <circle cx={sunX} cy={sunY} r={70 * sunR} fill={pal.sun} />

    {/* облака */}
    <Cloud x={210 - cloudOffset * 0.55} y={330} s={1.2} color={pal.cloud} opacity={0.95} />
    <Cloud x={830 - cloudOffset * 0.35} y={520} s={0.85} color={pal.cloud} opacity={0.9} />
    <Cloud x={430 - cloudOffset * 0.75} y={700} s={0.62} color={pal.cloud} opacity={0.7} />

    {/* дальние холмы */}
    <path
      d={`M ${-BLEED} 1090 Q 220 990 520 1060 Q 790 1120 ${VIDEO.width + BLEED} 1020 L ${VIDEO.width + BLEED} 1500 L ${-BLEED} 1500 Z`}
      fill={pal.hillFar}
    />

    {/* средний план: деревья */}
    <path
      d={`M ${-BLEED} 1170 Q 260 1110 600 1170 Q 880 1220 ${VIDEO.width + BLEED} 1150 L ${VIDEO.width + BLEED} 1500 L ${-BLEED} 1500 Z`}
      fill={pal.hill}
    />
    {[110, 300, 560, 820, 990].map((tx, i) => (
      <g key={i} transform={`translate(${tx} ${1140 + (i % 3) * 26}) scale(${0.75 + (i % 2) * 0.2})`}>
        <rect x={-8} y={-34} width={16} height={46} fill="#7A5A3A" />
        <circle cx={0} cy={-60} r={38} fill={pal.grassDark} />
        <circle cx={-18} cy={-44} r={24} fill={pal.grassDark} />
        <circle cx={18} cy={-48} r={26} fill={pal.grassDark} />
      </g>
    ))}

    {/* вода / поле на среднем плане */}
    {showWater && (
      <g>
        <rect x={-BLEED} y={1215} width={VIDEO.width + BLEED * 2} height={240} fill={pal.water} />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={-BLEED} y={1240 + i * 42} width={VIDEO.width + BLEED * 2} height={8} fill={pal.waterLight} opacity={0.45} />
        ))}
      </g>
    )}

    {/* трава и просадка грунта */}
    <g transform={`rotate(${groundTilt * 1.6} 540 ${GROUND_Y})`}>
      <rect x={-BLEED} y={GROUND_Y - 24} width={VIDEO.width + BLEED * 2} height={900} fill={pal.grass} />
      <rect x={-BLEED} y={GROUND_Y - 24} width={VIDEO.width + BLEED * 2} height={18} fill={pal.grassDark} opacity={0.45} />
      <path d={`M ${-BLEED} ${GROUND_Y + 150} Q 540 ${GROUND_Y + 96} ${VIDEO.width + BLEED} ${GROUND_Y + 140} L ${VIDEO.width + BLEED} 1920 L ${-BLEED} 1920 Z`} fill={pal.grassDark} opacity={0.28} />
      {showPath && (
        <path
          d={`M ${540 - 62} ${GROUND_Y - 26} L ${540 + 62} ${GROUND_Y - 26} L ${540 + 240} 1920 L ${540 - 320} 1920 Z`}
          fill={pal.path}
        />
      )}
      {[70, 1000].map((bx, i) => (
        <g key={i} transform={`translate(${bx} ${GROUND_Y + 40}) scale(1.1)`}>
          <ellipse cx={0} cy={0} rx={52} ry={30} fill={pal.grassDark} />
          <ellipse cx={-16} cy={-14} rx={30} ry={22} fill={pal.hill} />
        </g>
      ))}
    </g>
  </svg>
);
