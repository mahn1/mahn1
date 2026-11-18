import React from 'react';
import type { Palette } from './palette';

/**
 * Стилизованная Пизанская башня: барабаны с аркадами, толстый контур,
 * две краски на камень. Рисуется в локальных координатах:
 * (0, 0) — центр основания, ось Y смотрит вниз.
 */

const BASE_H = 168;
const TIER_H = 92;
const TIERS = 6;
const BELF_H = 104;
const TOTAL_H = BASE_H + TIERS * TIER_H + BELF_H;

const BASE_RX = 126;
const tierRx = (i: number) => 115 - i * 2.9;
const BELF_RX = 86;

const bandPath = (w: number, top: number, bottom: number, ell: number) =>
  `M ${-w / 2} ${top} L ${w / 2} ${top} L ${w / 2} ${bottom - ell} ` +
  `A ${w / 2} ${ell} 0 0 1 ${-w / 2} ${bottom - ell} Z`;

const columnXs = (rx: number, count: number, inset = 0.9) => {
  const out: { x: number }[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const a = (-1 + 2 * t) * (Math.PI / 2) * inset;
    out.push({ x: rx * Math.sin(a) });
  }
  return out;
};

const Tier: React.FC<{
  yTop: number;
  h: number;
  rx: number;
  pal: Palette;
  columns: number;
  thin?: boolean;
}> = ({ yTop, h, rx, pal, columns, thin }) => {
  const ell = thin ? 11 : 16;
  const yBot = yTop + h;
  const corniceTop = thin ? 15 : 19;
  const corniceBottom = thin ? 14 : 18;
  const w = rx * 2;
  const innerTop = yTop + ell * 0.4;
  const innerBottom = yBot - corniceBottom * 0.5;
  const cols = columnXs(rx, columns);
  const cw = thin ? 15 : 17;

  const openings: { x1: number; x2: number }[] = [];
  for (let i = 0; i < cols.length - 1; i++) {
    openings.push({ x1: cols[i].x + cw / 2, x2: cols[i + 1].x - cw / 2 });
  }

  return (
    <g>
      {/* глубина галереи */}
      <path
        d={bandPath(w, innerTop, innerBottom, ell * 0.6)}
        fill={pal.interior}
        stroke={pal.stoneLine}
        strokeWidth={5}
        strokeLinejoin="round"
      />

      {/* арки между колоннами */}
      {openings.map(({ x1, x2 }, i) => {
        const opW = x2 - x1;
        const r = Math.min(opW / 2, thin ? 30 : 22);
        const top = innerTop + (thin ? 16 : 20);
        const bottom = innerBottom - (thin ? 8 : 10);
        if (opW < 8) return null;
        return (
          <path
            key={i}
            d={`M ${x1 + 1} ${bottom} L ${x1 + 1} ${top + r} A ${r} ${r} 0 0 1 ${x2 - 1} ${top + r} L ${x2 - 1} ${bottom} Z`}
            fill={pal.interiorDark}
            stroke={pal.stoneLine}
            strokeWidth={3.5}
            strokeLinejoin="round"
          />
        );
      })}

      {/* колонны переднего плана */}
      {cols.map(({ x }, i) => (
        <g key={i}>
          <rect
            x={x - cw / 2}
            y={innerTop + 2}
            width={cw}
            height={innerBottom - innerTop - 2}
            rx={cw / 2.6}
            fill={i % 2 === 0 ? pal.stone : pal.stoneShade}
            stroke={pal.stoneLine}
            strokeWidth={4}
          />
          <rect
            x={x - cw / 2}
            y={yBot - corniceBottom - 12}
            width={cw}
            height={10}
            rx={3}
            fill={pal.stone}
            stroke={pal.stoneLine}
            strokeWidth={3.5}
          />
        </g>
      ))}

      {/* верхний карниз */}
      <path
        d={bandPath(w + (thin ? 12 : 18), yTop, yTop + corniceTop + ell * 0.5, ell * 0.55)}
        fill={pal.stone}
        stroke={pal.stoneLine}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <ellipse
        cx={0}
        cy={yTop}
        rx={rx + (thin ? 6 : 9)}
        ry={ell * 0.55}
        fill={pal.stone}
        stroke={pal.stoneLine}
        strokeWidth={5}
      />

      {/* нижний карниз */}
      <path
        d={bandPath(w + (thin ? 14 : 20), yBot - corniceBottom - ell * 0.4, yBot, ell * 0.5)}
        fill={pal.stone}
        stroke={pal.stoneLine}
        strokeWidth={5.5}
        strokeLinejoin="round"
      />
    </g>
  );
};

export const Tower: React.FC<{
  pal: Palette;
  /** наклон в градусах: положительный — вправо */
  lean?: number;
  /** 0 — башни нет, 1 — построена полностью */
  build?: number;
  /** просадка вниз в локальных единицах */
  sink?: number;
  clipId?: string;
  shadow?: boolean;
}> = ({ pal, lean = 0, build = 1, sink = 0, clipId = 'tower', shadow = true }) => {
  const reveal = Math.max(0.001, Math.min(1, build)) * TOTAL_H;
  const gid = `${clipId}-sh`;

  // силуэт башни: нужен, чтобы тени не вылезали за контур
  const silhouette: React.ReactNode[] = [];
  silhouette.push(<path key="b" d={bandPath(BASE_RX * 2, -BASE_H, 0, 20)} />);
  silhouette.push(<ellipse key="be" cx={0} cy={0} rx={BASE_RX} ry={15} />);
  Array.from({ length: TIERS }).forEach((_, i) => {
    const rx = tierRx(i);
    const yTop = -(BASE_H + (i + 1) * TIER_H);
    silhouette.push(<path key={`t${i}`} d={bandPath(rx * 2 + 18, yTop, yTop + TIER_H, 16)} />);
    silhouette.push(<ellipse key={`te${i}`} cx={0} cy={yTop} rx={rx + 9} ry={9} />);
  });
  silhouette.push(
    <path key="bf" d={bandPath(BELF_RX * 2 + 20, -(BASE_H + TIERS * TIER_H + BELF_H), -(BASE_H + TIERS * TIER_H), 11)} />,
    <ellipse key="bfe" cx={0} cy={-(BASE_H + TIERS * TIER_H)} rx={BELF_RX + 7} ry={7} />,
    <path key="cap" d={bandPath(BELF_RX * 2 + 20, -TOTAL_H - 18, -TOTAL_H + 6, 10)} />,
    <ellipse key="cape" cx={0} cy={-TOTAL_H - 18} rx={BELF_RX + 10} ry={10} />,
  );

  const body = (
    <g transform={`rotate(${lean}) translate(0 ${sink})`}>
      {/* основание */}
      <path d={bandPath(BASE_RX * 2, -BASE_H, 0, 15)} fill={pal.stone} stroke={pal.stoneLine} strokeWidth={6} strokeLinejoin="round" />
      {[-0.78, -0.5, -0.22, 0.06, 0.34, 0.62, 0.86].map((f, i) => (
        <line
          key={i}
          x1={BASE_RX * f}
          y1={-BASE_H + 52}
          x2={BASE_RX * f}
          y2={-24}
          stroke={pal.stoneShade}
          strokeWidth={5}
          strokeLinecap="round"
        />
      ))}
      <line x1={-BASE_RX + 4} y1={-BASE_H + 46} x2={BASE_RX - 4} y2={-BASE_H + 46} stroke={pal.stoneLine} strokeWidth={4} opacity={0.8} />
      <path
        d={`M -28 ${-6} L -28 ${-64} Q 0 ${-86} 28 ${-64} L 28 ${-6} Z`}
        fill={pal.interiorDark}
        stroke={pal.stoneLine}
        strokeWidth={5.5}
        strokeLinejoin="round"
      />
      <ellipse cx={0} cy={0} rx={BASE_RX} ry={15} fill={pal.stone} stroke={pal.stoneLine} strokeWidth={6} />

      {/* ярусы */}
      {Array.from({ length: TIERS }).map((_, i) => (
        <Tier
          key={i}
          yTop={-(BASE_H + (i + 1) * TIER_H)}
          h={TIER_H}
          rx={tierRx(i)}
          pal={pal}
          columns={i === TIERS - 1 ? 8 : 9}
        />
      ))}

      {/* звонница */}
      <Tier yTop={-(BASE_H + TIERS * TIER_H + BELF_H)} h={BELF_H} rx={BELF_RX} pal={pal} columns={6} thin />

      {/* верхний венец */}
      <path
        d={bandPath(BELF_RX * 2 + 20, -TOTAL_H - 18, -TOTAL_H + 6, 10)}
        fill={pal.stone}
        stroke={pal.stoneLine}
        strokeWidth={5.5}
        strokeLinejoin="round"
      />
      <ellipse cx={0} cy={-TOTAL_H - 18} rx={BELF_RX + 10} ry={10} fill={pal.stone} stroke={pal.stoneLine} strokeWidth={5.5} />

      {/* объём: свет слева, тень справа — строго внутри силуэта */}
      <g clipPath={`url(#${gid}-sil)`}>
        <rect x={-BASE_RX - 20} y={-TOTAL_H - 40} width={BASE_RX + 20} height={TOTAL_H + 60} fill={`url(#${gid}-l)`} />
        <rect x={0} y={-TOTAL_H - 40} width={BASE_RX + 20} height={TOTAL_H + 60} fill={`url(#${gid}-r)`} />
      </g>
    </g>
  );

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={-420} y={-reveal} width={840} height={reveal + 60} />
        </clipPath>
        <clipPath id={`${gid}-sil`}>{silhouette}</clipPath>
        <linearGradient id={`${gid}-l`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.22} />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
        </linearGradient>
        <linearGradient id={`${gid}-r`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={pal.shade} stopOpacity={0} />
          <stop offset="100%" stopColor={pal.shade} stopOpacity={0.55} />
        </linearGradient>
      </defs>
      {shadow && <ellipse cx={lean * 3} cy={6} rx={BASE_RX * 1.3} ry={28} fill={pal.shadow} />}
      <g clipPath={`url(#${clipId})`}>{body}</g>
    </g>
  );
};

export const TOWER_TOTAL_H = TOTAL_H;
export const TOWER_RX = BASE_RX;
