import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

/** Montserrat с кириллицей — жирный, с обводкой, как в роликах-референсах. */
export const FONT = 'Montserrat';

const faces = [
  { file: 'montserrat-cyrillic-900-normal.woff2', weight: '900', range: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116' },
  { file: 'montserrat-cyrillic-700-normal.woff2', weight: '700', range: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116' },
  { file: 'montserrat-latin-900-normal.woff2', weight: '900', range: 'U+0000-00FF,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215' },
  { file: 'montserrat-latin-700-normal.woff2', weight: '700', range: 'U+0000-00FF,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215' },
];

export const ensureFonts = () =>
  Promise.all(
    faces.map((f) =>
      loadFont({
        family: FONT,
        url: staticFile(`fonts/${f.file}`),
        weight: f.weight,
        unicodeRange: f.range,
      }),
    ),
  );
