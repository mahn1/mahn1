import { interpolateColors } from 'remotion';

/** Вся временная шкала ролика в кадрах (30 fps). */
export const DURATION = 1080;

export type Palette = {
  skyTop: string;
  skyBottom: string;
  hill: string;
  hillFar: string;
  grass: string;
  grassDark: string;
  path: string;
  stone: string;
  stoneShade: string;
  stoneLine: string;
  stoneDark: string;
  water: string;
  waterLight: string;
  sun: string;
  cloud: string;
  shadow: string;
  /** внутренность галереи (глубина) */
  interior: string;
  /** глубина арки (тёмный проём) */
  interiorDark: string;
  /** полупрозрачная тень на камне */
  shade: string;
};

const DAY: Palette = {
  skyTop: '#3FA8F0',
  skyBottom: '#A9E0FB',
  hill: '#A9DB6F',
  hillFar: '#C4E79A',
  grass: '#8ED24A',
  grassDark: '#6CBF3A',
  path: '#F6EFD3',
  stone: '#F4F0E5',
  stoneShade: '#CFC6B0',
  stoneLine: '#4B4436',
  stoneDark: '#6B6151',
  water: '#3A8FB7',
  waterLight: '#7FD0E8',
  sun: '#FFF3C4',
  cloud: '#FFFFFF',
  shadow: 'rgba(45,80,20,0.18)',
  interior: '#6E6557',
  interiorDark: '#494134',
  shade: '#6F6757',
};

const SUNSET: Palette = {
  skyTop: '#7C4E9B',
  skyBottom: '#F9A661',
  hill: '#7C9A5A',
  hillFar: '#A08CA8',
  grass: '#7EB143',
  grassDark: '#5F9334',
  path: '#EFC583',
  stone: '#E4D3DD',
  stoneShade: '#A994A6',
  stoneLine: '#3B2B36',
  stoneDark: '#5A4550',
  water: '#2F6E92',
  waterLight: '#6FA9C4',
  sun: '#FFE3A6',
  cloud: '#FFE0C4',
  shadow: 'rgba(60,30,60,0.24)',
  interior: '#5A4655',
  interiorDark: '#2F2530',
  shade: '#4B3A45',
};

/** t: 0 — день, 1 — закат. */
export const mixPalette = (t: number): Palette => {
  const keys = Object.keys(DAY) as (keyof Palette)[];
  const out = {} as Palette;
  for (const k of keys) {
    out[k] = interpolateColors(
      Math.min(1, Math.max(0, t)),
      [0, 1],
      [DAY[k], SUNSET[k]],
    );
  }
  return out;
};
