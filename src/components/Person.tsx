import React from 'react';
import type { Palette } from '../world/palette';

/**
 * Человечки в стиле референсов: круглая голова, палочки-руки и ноги,
 * крупные ботинки, толстый контур. Пропорции — «детские», 3.5 головы.
 */

export type PersonProps = {
  x: number;
  y: number;
  /** масштаб: 1 — высота около 210 единиц */
  scale?: number;
  shirt: string;
  pants?: string;
  skin?: string;
  hair?: string;
  hat?: 'cap' | 'helmet' | 'none';
  hatColor?: string;
  /** фаза шага, в радианах */
  walk?: number;
  /** наклон корпуса, в градусах */
  tilt?: number;
  /** 0..1 — насколько подняты руки */
  armsUp?: number;
  /** предмет в руке */
  tool?: 'hammer' | 'none';
  pal: Palette;
  outline?: number;
};

export const Person: React.FC<PersonProps> = ({
  x,
  y,
  scale = 1,
  shirt,
  pants = '#3B4A6B',
  skin = '#F2D2A9',
  hair = '#2E241C',
  hat = 'none',
  hatColor = '#C93A2E',
  walk = 0,
  tilt = 0,
  armsUp = 0,
  tool = 'none',
  pal,
  outline = 6,
}) => {
  const legSwing = Math.sin(walk) * 13;
  const armSwing = Math.sin(walk + Math.PI) * 10;
  const stroke = { stroke: pal.stoneLine, strokeWidth: outline, strokeLinecap: 'round' as const };

  const armAngleL = -28 - armsUp * 100 + armSwing;
  const armAngleR = 28 + armsUp * 100 - armSwing;

  return (
    <g transform={`translate(${x} ${y}) scale(${scale}) rotate(${tilt})`}>
      {/* тень */}
      <ellipse cx={0} cy={0} rx={36} ry={9} fill={pal.shadow} />

      {/* ноги */}
      <line x1={-10} y1={-72} x2={-14 - legSwing * 0.6} y2={-6} {...stroke} strokeWidth={13} />
      <line x1={10} y1={-72} x2={14 + legSwing * 0.6} y2={-6} {...stroke} strokeWidth={13} />
      <ellipse cx={-15 - legSwing * 0.6} cy={-4} rx={14} ry={7} fill={pal.stoneLine} />
      <ellipse cx={15 + legSwing * 0.6} cy={-4} rx={14} ry={7} fill={pal.stoneLine} />

      {/* корпус */}
      <path
        d="M -22 -112 Q -26 -74 -20 -66 L 20 -66 Q 26 -74 22 -112 Z"
        fill={shirt}
        stroke={pal.stoneLine}
        strokeWidth={outline}
        strokeLinejoin="round"
      />
      <path d="M 6 -110 Q 16 -92 12 -68 L 22 -68 Q 26 -76 22 -110 Z" fill="rgba(0,0,0,0.14)" />

      {/* руки */}
      <g transform={`translate(-20 -104) rotate(${armAngleL})`}>
        <line x1={0} y1={0} x2={0} y2={34} {...stroke} strokeWidth={12} />
        <circle cx={0} cy={36} r={8} fill={skin} stroke={pal.stoneLine} strokeWidth={outline} />
        {tool === 'hammer' && (
          <g transform="translate(0 36)">
            <rect x={-3} y={-6} width={6} height={34} fill="#B5793C" stroke={pal.stoneLine} strokeWidth={4} rx={2} />
            <rect x={-14} y={-16} width={28} height={14} fill="#9AA3AC" stroke={pal.stoneLine} strokeWidth={4} rx={3} />
          </g>
        )}
      </g>
      <g transform={`translate(20 -104) rotate(${armAngleR})`}>
        <line x1={0} y1={0} x2={0} y2={34} {...stroke} strokeWidth={12} />
        <circle cx={0} cy={36} r={8} fill={skin} stroke={pal.stoneLine} strokeWidth={outline} />
      </g>

      {/* голова */}
      <g transform="translate(0 -140)">
        <circle cx={0} cy={0} r={30} fill={skin} stroke={pal.stoneLine} strokeWidth={outline} />
        {/* причёска / шлем */}
        {hat === 'none' && (
          <path d="M -30 -4 Q -28 -32 0 -31 Q 28 -32 30 -4 Q 12 -16 0 -14 Q -14 -16 -30 -4 Z" fill={hair} stroke={pal.stoneLine} strokeWidth={outline} strokeLinejoin="round" />
        )}
        {hat === 'cap' && (
          <>
            <path d="M -30 -10 Q -30 -38 0 -38 Q 30 -38 30 -10 Z" fill={hatColor} stroke={pal.stoneLine} strokeWidth={outline} strokeLinejoin="round" />
            <path d="M 6 -12 Q 34 -14 38 -6 Q 28 -2 6 -4 Z" fill={hatColor} stroke={pal.stoneLine} strokeWidth={outline} strokeLinejoin="round" />
          </>
        )}
        {hat === 'helmet' && (
          <>
            <path d="M -32 -8 Q -32 -40 0 -40 Q 32 -40 32 -8 Z" fill={hatColor} stroke={pal.stoneLine} strokeWidth={outline} strokeLinejoin="round" />
            <rect x={-40} y={-12} width={80} height={9} rx={4} fill={hatColor} stroke={pal.stoneLine} strokeWidth={outline} />
          </>
        )}
        {/* глаза и улыбка — поверх шапки, чтобы не прятались под козырьком */}
        <circle cx={-10} cy={2} r={3.2} fill={pal.stoneLine} />
        <circle cx={10} cy={2} r={3.2} fill={pal.stoneLine} />
        <path d="M -8 14 Q 0 21 8 14" fill="none" stroke={pal.stoneLine} strokeWidth={4} strokeLinecap="round" />
      </g>
    </g>
  );
};
