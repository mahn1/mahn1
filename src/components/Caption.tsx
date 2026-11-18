import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONT_FAMILY } from '../theme';

/**
 * Русские субтитры «по одному слову» (как в оригинальном ролике).
 * Слово появляется с пружинкой, предыдущее остаётся в строке —
 * получается «накопительная» фраза.
 */

export type CaptionLine = {
  from: number;
  to: number;
  words: string[];
};

/** Одна фраза: слова появляются по очереди. */
export const makeLine = (
  from: number,
  to: number,
  text: string,
): CaptionLine => ({ from, to, words: text.split(' ') });

/**
 * Длинная фраза разбивается на короткие «кадры» — по 2–3 слова,
 * чтобы на экране никогда не висела вся фраза целиком.
 */
export const makePhrase = (
  from: number,
  to: number,
  text: string,
  perLine = 3,
): CaptionLine[] => {
  const words = text.split(' ');
  const groups: string[][] = [];
  for (let i = 0; i < words.length; i += perLine) groups.push(words.slice(i, i + perLine));
  const span = (to - from) / groups.length;
  return groups.map((g, i) => ({
    from: Math.round(from + span * i),
    to: Math.round(from + span * (i + 1) - (i === groups.length - 1 ? 0 : 1)),
    words: g,
  }));
};

/** Раскладка слов по строкам: не больше `maxChars` знаков в строке. */
const layout = (words: string[], maxChars = 16) => {
  const rows: string[][] = [];
  let cur: string[] = [];
  let len = 0;
  for (const w of words) {
    const add = w.length + (cur.length ? 1 : 0);
    if (len + add > maxChars && cur.length) {
      rows.push(cur);
      cur = [w];
      len = w.length;
    } else {
      cur = [...cur, w];
      len += add;
    }
  }
  if (cur.length) rows.push(cur);
  return rows;
};

export const Caption: React.FC<{
  lines: CaptionLine[];
  /** базовая позиция по вертикали */
  top?: number;
  fontSize?: number;
}> = ({ lines, top = 1310, fontSize = 74 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const line = lines.find((l) => frame >= l.from && frame < l.to);
  if (!line) return null;

  const elapsed = frame - line.from;
  const step = Math.max(3, Math.floor((line.to - line.from) / line.words.length));
  const visible = Math.min(line.words.length, Math.floor(elapsed / step) + 1);
  const shownWords = line.words.slice(0, visible);

  const rows = layout(shownWords, 11);
  const pop = spring({ frame: elapsed % step, fps, config: { damping: 11, stiffness: 220, mass: 0.5 } });

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        paddingInline: 60,
      }}
    >
      {rows.map((row, ri) => (
        <div
          key={ri}
          style={{
            display: 'flex',
            gap: fontSize * 0.28,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {row.map((w, wi) => {
            const isLast = ri === rows.length - 1 && wi === row.length - 1;
            const scale = isLast ? 0.86 + 0.14 * pop : 1;
            return (
              <span
                key={`${w}-${wi}`}
                style={{
                  fontFamily: FONT_FAMILY,
                  fontWeight: 900,
                  fontSize,
                  lineHeight: 1.05,
                  color: COLORS.white,
                  letterSpacing: '-0.015em',
                  WebkitTextStroke: `${fontSize * 0.13}px #0B0B0B`,
                  paintOrder: 'stroke fill',
                  textShadow: '0 8px 0 rgba(0,0,0,0.32)',
                  transform: `scale(${scale})`,
                  display: 'inline-block',
                  whiteSpace: 'nowrap',
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};
