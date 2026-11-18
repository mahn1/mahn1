/**
 * Палитра, шрифты и базовые размеры для анимации.
 * Графика нарочно плоская и «мультяшная»: жирные контуры, два оттенка
 * на объект, длинные мягкие тени — как в референсах.
 */

export const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 30,
} as const;

export const COLORS = {
  // день
  skyTopDay: '#3FA8F0',
  skyBottomDay: '#8FD3F7',
  grassLight: '#8ED24A',
  grassDark: '#6CBF3A',
  hillFar: '#A9DB6F',
  stoneLight: '#F3EFE4',
  stoneMid: '#DCD6C7',
  stoneShadow: '#B9B1A1',
  stoneLine: '#4A4438',
  // закат
  skyTopSunset: '#8E5FA8',
  skyBottomSunset: '#F6A05C',
  sunGlow: '#FFD08A',
  water: '#3A8FB7',
  waterLight: '#67C3DF',
  // люди
  skin: '#F2D2A9',
  skinShadow: '#D9B286',
  red: '#C93A2E',
  yellow: '#F2B33D',
  green: '#3F8F5B',
  blue: '#3B5BA5',
  orange: '#E07A2F',
  ink: '#2B2419',
  white: '#FFFFFF',
} as const;

export const FONT_FAMILY = 'Montserrat, Arial, sans-serif';

/** Жирный «тиктоковский» подзаголовок с обводкой. */
export const captionStyle: React.CSSProperties = {
  fontFamily: FONT_FAMILY,
  fontWeight: 900,
  color: COLORS.white,
  letterSpacing: '-0.01em',
  lineHeight: 1.05,
  textAlign: 'center',
  WebkitTextStroke: '10px #101010',
  paintOrder: 'stroke fill',
  textShadow: '0 10px 0 rgba(0,0,0,0.35)',
};
