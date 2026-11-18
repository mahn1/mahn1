import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Backdrop, GROUND_Y } from './components/Backdrop';
import { Caption, makePhrase } from './components/Caption';
import { Person } from './components/Person';
import { Tower } from './world/Tower';
import { mixPalette } from './world/palette';
import { COLORS, FONT_FAMILY, VIDEO } from './theme';

/* ------------------------------------------------------------------ */
/*  камера                                                             */
/* ------------------------------------------------------------------ */

const Camera: React.FC<{
  zoom?: number;
  focusX?: number;
  focusY?: number;
  rotate?: number;
  shake?: number;
  children: React.ReactNode;
}> = ({ zoom = 1, focusX = 540, focusY = 960, rotate = 0, shake = 0, children }) => {
  const frame = useCurrentFrame();
  const dx = Math.sin(frame * 2.7) * shake;
  const dy = Math.cos(frame * 3.4) * shake * 0.7;
  return (
    <g
      transform={`translate(${VIDEO.width / 2 + dx} ${VIDEO.height / 2 + dy}) rotate(${rotate}) scale(${zoom}) translate(${-focusX} ${-focusY})`}
    >
      {children}
    </g>
  );
};

/* ------------------------------------------------------------------ */
/*  мелкие эффекты                                                     */
/* ------------------------------------------------------------------ */

const Sweat: React.FC<{ x: number; y: number; t: number; color?: string }> = ({
  x,
  y,
  t,
  color = '#8FD8FF',
}) => {
  const k = t % 1;
  return (
    <g transform={`translate(${x} ${y - k * 160}) scale(${0.9 + k * 0.3})`} opacity={1 - k}>
      <path
        d="M 0 0 C 10 18 16 26 16 34 C 16 43 9 50 0 50 C -9 50 -16 43 -16 34 C -16 26 -10 18 0 0 Z"
        fill={color}
        stroke="#2B2419"
        strokeWidth={4}
      />
    </g>
  );
};

const DustPuff: React.FC<{ x: number; y: number; r: number; opacity: number; color: string }> = ({
  x,
  y,
  r,
  opacity,
  color,
}) => (
  <g opacity={opacity}>
    <circle cx={x} cy={y} r={r} fill={color} />
    <circle cx={x - r * 0.8} cy={y + r * 0.2} r={r * 0.65} fill={color} />
    <circle cx={x + r * 0.85} cy={y + r * 0.1} r={r * 0.7} fill={color} />
  </g>
);

const Crack: React.FC<{ x: number; y: number; s?: number; color: string; opacity?: number }> = ({
  x,
  y,
  s = 1,
  color,
  opacity = 1,
}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity}>
    <path
      d="M 0 0 L -9 18 L 4 32 L -7 52 L 6 74"
      fill="none"
      stroke={color}
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M 4 32 L 24 42 M -7 52 L -24 62" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  </g>
);

/** Табличка «ЗАКРЫТО» на стойках — как в референсе. */
const ClosedSign: React.FC<{ x: number; y: number; s?: number; pal: ReturnType<typeof mixPalette> }> = ({
  x,
  y,
  s = 1,
  pal,
}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x={-10} y={-60} width={8} height={62} fill={pal.stoneLine} />
    <rect x={106} y={-60} width={8} height={62} fill={pal.stoneLine} />
    <rect x={-24} y={-108} width={152} height={48} rx={6} fill={COLORS.yellow} stroke={pal.stoneLine} strokeWidth={6} />
    <text
      x={52}
      y={-74}
      textAnchor="middle"
      fontFamily={FONT_FAMILY}
      fontWeight={900}
      fontSize={25}
      fill={pal.stoneLine}
    >
      ЗАКРЫТО
    </text>
  </g>
);

/* ------------------------------------------------------------------ */
/*  сцены                                                              */
/* ------------------------------------------------------------------ */

const TOWER_X = 540;
const TOWER_SCALE = 1.5;

const TowerInWorld: React.FC<{
  pal: ReturnType<typeof mixPalette>;
  lean: number;
  build?: number;
  sink?: number;
  y?: number;
  clipId?: string;
  opacity?: number;
}> = ({ pal, lean, build = 1, sink = 0, y = GROUND_Y + 8, clipId = 'tw', opacity = 1 }) => (
  <g opacity={opacity}>
    <g transform={`translate(${TOWER_X} ${y}) scale(${TOWER_SCALE})`}>
      <Tower pal={pal} lean={lean} build={build} sink={sink} clipId={clipId} />
    </g>
  </g>
);

/* --- 1. стройка ---------------------------------------------------- */

const SceneBuild: React.FC<{ pal: ReturnType<typeof mixPalette> }> = ({ pal }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const build = interpolate(frame, [0, 105], [0.02, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.3, 0.1, 0.3, 1),
  });
  const bob = (i: number) => Math.sin(frame / 6 + i * 1.7) * 3;

  return (
    <>
      <Backdrop pal={pal} cloudOffset={frame} sunX={820} sunY={600} />
      <TowerInWorld pal={pal} lean={0} build={build} />
      {[
        { x: 250, shirt: COLORS.red, hat: 'none' as const, tool: 'none' as const },
        { x: 380, shirt: COLORS.green, hat: 'cap' as const, tool: 'none' as const },
        { x: 720, shirt: COLORS.orange, hat: 'cap' as const, tool: 'hammer' as const },
        { x: 860, shirt: COLORS.yellow, hat: 'none' as const, tool: 'none' as const },
      ].map((p, i) => (
        <Person
          key={i}
          x={p.x}
          y={GROUND_Y + 60 + bob(i)}
          scale={1.05}
          shirt={p.shirt}
          hat={p.hat}
          tool={p.tool}
          hatColor={p.hat === 'cap' ? COLORS.yellow : COLORS.red}
          pal={pal}
          walk={p.tool === 'hammer' ? frame / 3 : 0}
          armsUp={p.tool === 'hammer' ? 0.35 + Math.sin(frame / 4) * 0.12 : 0}
        />
      ))}
    </>
  );
};

/* --- 2. наклон ----------------------------------------------------- */

const SceneTilt: React.FC<{ pal: ReturnType<typeof mixPalette> }> = ({ pal }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lean = spring({ frame: frame - 12, fps, config: { damping: 12, stiffness: 45 }, durationInFrames: 110 });
  const angle = lean * 6.2;

  return (
    <>
      <Backdrop pal={pal} cloudOffset={frame * 0.6} sunX={740} sunY={700} />
      <Camera zoom={0.94} focusX={540} focusY={980}>
        <TowerInWorld pal={pal} lean={angle} clipId="tw2" />
      {[
        { x: 200, shirt: COLORS.yellow, hat: 'none' as const },
        { x: 320, shirt: COLORS.red, hat: 'cap' as const },
        { x: 760, shirt: COLORS.blue, hat: 'none' as const },
        { x: 880, shirt: COLORS.green, hat: 'cap' as const },
      ].map((p, i) => (
        <Person
          key={i}
          x={p.x}
          y={GROUND_Y + 64}
          scale={1.02}
          shirt={p.shirt}
          hat={p.hat}
          hatColor={COLORS.blue}
          pal={pal}
          tilt={(i < 2 ? -1 : 1) * (4 + lean * 0.9)}
          armsUp={0.55 + Math.sin(frame / 7 + i) * 0.2}
          walk={frame / 4 + i}
        />
      ))}
      </Camera>
    </>
  );
};

/* --- 3. крупный план ----------------------------------------------- */

const SceneCloseup: React.FC<{ pal: ReturnType<typeof mixPalette> }> = ({ pal }) => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, 130], [1.9, 2.35], { extrapolateRight: 'clamp' });
  return (
    <>
      <Backdrop pal={pal} cloudOffset={frame * 0.3} sunX={700} sunY={640} showPath={false} />
      <Camera zoom={zoom} focusX={600} focusY={1000} rotate={-1.6}>
        <TowerInWorld pal={pal} lean={6.2} clipId="tw3" />
      </Camera>
    </>
  );
};

/* --- 4. разрез грунта ---------------------------------------------- */

const SOIL_TOP = GROUND_Y + 4;

const SoilCutaway: React.FC<{ pal: ReturnType<typeof mixPalette>; sag?: number; cracks?: number }> = ({
  pal,
  sag = 0,
  cracks = 0,
}) => (
  <g>
    <rect x={0} y={SOIL_TOP} width={VIDEO.width} height={VIDEO.height - SOIL_TOP} fill="#C89A62" />
    <rect x={0} y={SOIL_TOP} width={VIDEO.width} height={26} fill="#8B5E34" />
    <path
      d={`M 0 ${SOIL_TOP + 90 + sag} Q 270 ${SOIL_TOP + 40 + sag} 540 ${SOIL_TOP + 110 + sag} Q 820 ${SOIL_TOP + 178 + sag} 1080 ${SOIL_TOP + 100 + sag}`}
      fill="none"
      stroke="#A97A46"
      strokeWidth={26}
      strokeLinecap="round"
    />
    <path
      d={`M 0 ${SOIL_TOP + 250} Q 300 ${SOIL_TOP + 200} 600 ${SOIL_TOP + 262} Q 860 ${SOIL_TOP + 312} 1080 ${SOIL_TOP + 240}`}
      fill="none"
      stroke="#B98A55"
      strokeWidth={18}
      strokeLinecap="round"
      opacity={0.8}
    />
    {/* глина — мягкие «подушки» */}
    {[
      [180, SOIL_TOP + 180, 62],
      [420, SOIL_TOP + 230, 48],
      [700, SOIL_TOP + 200, 70],
      [930, SOIL_TOP + 260, 52],
    ].map(([cx, cy, r], i) => (
      <ellipse
        key={i}
        cx={cx}
        cy={Number(cy) + sag * 0.6}
        rx={r}
        ry={Number(r) * 0.55}
        fill="#D8AE79"
        stroke="#A97A46"
        strokeWidth={4}
        opacity={0.9}
      />
    ))}
    {/* водоносный слой */}
    <rect x={0} y={VIDEO.height - 150} width={VIDEO.width} height={150} fill={pal.water} opacity={0.55} />
    <path
      d={`M 0 ${VIDEO.height - 154} Q 270 ${VIDEO.height - 176} 540 ${VIDEO.height - 150} Q 820 ${VIDEO.height - 124} 1080 ${VIDEO.height - 154} L 1080 ${VIDEO.height - 130} Q 820 ${VIDEO.height - 100} 540 ${VIDEO.height - 126} Q 270 ${VIDEO.height - 152} 0 ${VIDEO.height - 130} Z`}
      fill={pal.waterLight}
      opacity={0.75}
    />
    {/* камни */}
    {[
      [120, SOIL_TOP + 330],
      [860, SOIL_TOP + 350],
      [640, SOIL_TOP + 400],
    ].map(([cx, cy], i) => (
      <ellipse key={i} cx={cx} cy={cy} rx={34} ry={22} fill="#9C8B74" stroke="#7A6A55" strokeWidth={4} />
    ))}
    {cracks > 0 && (
      <>
        <Crack x={TOWER_X - 155} y={SOIL_TOP + 16} s={cracks * 1.0} color="#6B4423" opacity={0.9} />
        <Crack x={TOWER_X + 185} y={SOIL_TOP + 12} s={cracks * 0.85} color="#6B4423" opacity={0.85} />
        <Crack x={TOWER_X - 60} y={SOIL_TOP + 30} s={cracks * 0.7} color="#6B4423" opacity={0.7} />
      </>
    )}
  </g>
);

const SceneGround: React.FC<{ pal: ReturnType<typeof mixPalette>; press: number }> = ({ pal, press }) => {
  const frame = useCurrentFrame();
  const sag = 18 + Math.sin(frame / 9) * 8;
  return (
    <>
      <Backdrop pal={pal} cloudOffset={frame * 0.4} sunX={820} sunY={560} showPath={false} />
      <SoilCutaway pal={pal} sag={sag} />
      {/* нижняя часть башни над землёй */}
      <TowerInWorld pal={pal} lean={5.6} clipId="tw4" />
      {/* рабочий, который «давит» на башню */}
      <Person
        x={TOWER_X + 260}
        y={GROUND_Y + 54}
        scale={1.35}
        shirt={COLORS.orange}
        hat="helmet"
        hatColor={COLORS.yellow}
        pal={pal}
        tilt={12 * press}
        armsUp={0.5 + 0.35 * press}
        walk={frame / 3}
      />
      {/* стрелка вниз */}
      <g transform={`translate(${TOWER_X - 230} ${GROUND_Y + 120 + Math.sin(frame / 8) * 10})`} opacity={0.9}>
        <path d="M 0 0 L 0 90 M -26 70 L 0 104 L 26 70" fill="none" stroke="#FFFFFF" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </>
  );
};

/* --- 5. просадка ---------------------------------------------------- */

const SceneSink: React.FC<{ pal: ReturnType<typeof mixPalette> }> = ({ pal }) => {
  const frame = useCurrentFrame();
  const sink = interpolate(frame, [0, 100], [0, 46], { extrapolateRight: 'clamp', easing: Easing.in(Easing.quad) });
  const lean = interpolate(frame, [0, 100], [5.6, 7.4], { extrapolateRight: 'clamp' });
  return (
    <>
      <Backdrop pal={pal} cloudOffset={frame * 0.5} sunX={800} sunY={560} showPath={false} />
      <SoilCutaway pal={pal} sag={30} cracks={interpolate(frame, [20, 80], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
      <TowerInWorld pal={pal} lean={lean} sink={sink / TOWER_SCALE} clipId="tw5" />
      <Person
        x={200}
        y={GROUND_Y + 60}
        scale={1.2}
        shirt={COLORS.blue}
        hat="helmet"
        hatColor={COLORS.yellow}
        pal={pal}
        armsUp={0.3}
        tilt={-4}
        walk={frame / 5}
      />
      {[0, 1, 2].map((i) => (
        <Sweat key={i} x={205 + i * 22} y={GROUND_Y - 165} t={(frame + i * 15) / 42} />
      ))}
    </>
  );
};

/* --- 6. «она падает» ------------------------------------------------ */

const SceneFall: React.FC<{ pal: ReturnType<typeof mixPalette> }> = ({ pal }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fall = spring({ frame: frame - 18, fps, config: { damping: 14, stiffness: 42 }, durationInFrames: 78 });
  const angle = fall * 80;
  const hit = interpolate(frame, [70, 78, 90], [0, 1, 0.8], { extrapolateRight: 'clamp' });
  return (
    <>
      <Backdrop pal={pal} cloudOffset={frame * 0.5} sunX={780} sunY={620} />
      <Camera zoom={0.74} focusX={700} focusY={980} shake={hit * 9}>
        <TowerInWorld pal={pal} lean={angle} clipId="tw6" />
        {hit > 0.05 &&
          [0, 1, 2, 3, 4, 5].map((i) => (
            <DustPuff
              key={i}
              x={TOWER_X + 120 + i * 90}
              y={GROUND_Y + 20 - (i % 2) * 40}
              r={40 + hit * (30 + i * 12)}
              opacity={0.85 * hit}
              color="#F3E7D2"
            />
          ))}
        <Person x={230} y={GROUND_Y + 50} scale={1.15} shirt={COLORS.red} hat="cap" hatColor={COLORS.blue} pal={pal} armsUp={0.95} tilt={-10} />
        <Person x={900} y={GROUND_Y + 60} scale={1.1} shirt={COLORS.green} pal={pal} armsUp={0.9} tilt={14} />
        <ClosedSign x={300} y={GROUND_Y + 56} s={1.1} pal={pal} />
      </Camera>
    </>
  );
};

/* --- 7. туристы ----------------------------------------------------- */

const SceneTourists: React.FC<{ pal: ReturnType<typeof mixPalette> }> = ({ pal }) => {
  const frame = useCurrentFrame();
  const jump = (i: number) => Math.max(0, Math.sin(frame / 7 + i * 1.3)) * 12;
  const people = [
    { x: 170, shirt: COLORS.red, hat: 'none' as const },
    { x: 285, shirt: COLORS.yellow, hat: 'cap' as const },
    { x: 395, shirt: COLORS.green, hat: 'none' as const },
    { x: 700, shirt: COLORS.blue, hat: 'cap' as const },
    { x: 815, shirt: COLORS.orange, hat: 'none' as const },
    { x: 930, shirt: COLORS.red, hat: 'none' as const },
  ];
  return (
    <>
      <Backdrop pal={pal} cloudOffset={frame * 0.6} sunX={790} sunY={620} showPath={false} />
      <TowerInWorld pal={pal} lean={5.9} clipId="tw7" />
      {people.map((p, i) => (
        <Person
          key={i}
          x={p.x}
          y={GROUND_Y + 62 - jump(i)}
          scale={1.0}
          shirt={p.shirt}
          hat={p.hat}
          hatColor={i % 2 ? COLORS.red : COLORS.green}
          pal={pal}
          armsUp={0.75 + Math.sin(frame / 9 + i) * 0.25}
          walk={frame / 6 + i}
        />
      ))}
      {/* флажок/селфи-палка */}
      <g transform={`translate(258 ${GROUND_Y - 168}) rotate(-14 + Math.sin(frame / 12) * 4)`}>
        <line x1={0} y1={0} x2={0} y2={-96} stroke={pal.stoneLine} strokeWidth={7} strokeLinecap="round" />
        <rect x={-15} y={-124} width={30} height={26} rx={5} fill={COLORS.white} stroke={pal.stoneLine} strokeWidth={5} />
      </g>
    </>
  );
};

/* --- 8. инженеры тянут обратно -------------------------------------- */

const SceneCranes: React.FC<{ pal: ReturnType<typeof mixPalette> }> = ({ pal }) => {
  const frame = useCurrentFrame();
  const pull = interpolate(frame, [10, 110], [0, 1], { extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const lean = 7.0 - pull * 3.0;
  return (
    <>
      <Backdrop pal={pal} cloudOffset={frame * 0.5} sunX={300} sunY={560} />
      <TowerInWorld pal={pal} lean={lean} clipId="tw8" />
      {/* тросы к верхушке */}
      <g>
        {[0, 1, 2].map((i) => {
          const topX = TOWER_X + Math.sin((lean * Math.PI) / 180) * 700;
          const topY = GROUND_Y - 700;
          const ax = 120 + i * 60;
          const ay = GROUND_Y + 40;
          return (
            <line
              key={i}
              x1={ax}
              y1={ay}
              x2={topX - i * 40}
              y2={topY + i * 70}
              stroke="#3B3B3B"
              strokeWidth={5}
              opacity={0.85}
            />
          );
        })}
      </g>
      <Person x={150} y={GROUND_Y + 56} scale={1.15} shirt={COLORS.yellow} hat="helmet" hatColor={COLORS.yellow} pal={pal} armsUp={0.8} tilt={-6} walk={frame / 9} />
      <Person x={265} y={GROUND_Y + 62} scale={1.1} shirt={COLORS.orange} hat="helmet" hatColor={COLORS.orange} pal={pal} armsUp={0.85} tilt={-5} walk={frame / 11} />
      <Person x={880} y={GROUND_Y + 58} scale={1.15} shirt={COLORS.blue} hat="none" pal={pal} armsUp={0.2} tilt={6} walk={frame / 8} />
      {/* лебёдка */}
      <g transform={`translate(190 ${GROUND_Y + 40})`}>
        <rect x={-46} y={-56} width={92} height={56} rx={8} fill="#5C6672" stroke={pal.stoneLine} strokeWidth={6} />
        <circle cx={0} cy={-28} r={17} fill="#9AA3AC" stroke={pal.stoneLine} strokeWidth={5} />
        <line x1={0} y1={-28} x2={0} y2={-42} stroke={pal.stoneLine} strokeWidth={5} strokeLinecap="round" transform={`rotate(${frame * 9})`} />
      </g>
    </>
  );
};

/* ------------------------------------------------------------------ */
/*  сборка                                                            */
/* ------------------------------------------------------------------ */

export const Captions = () => (
  <Caption
    lines={[
      ...makePhrase(0, 88, 'Пизанскую башню строили', 2),
      ...makePhrase(88, 142, 'как обычную колокольню', 2),

      ...makePhrase(146, 236, 'Но грунт оказался', 2),
      ...makePhrase(236, 292, 'слишком мягким', 2),

      ...makePhrase(296, 344, 'И она начала', 2),
      ...makePhrase(344, 420, 'клониться вбок', 2),

      ...makePhrase(424, 520, 'Под ней глина и вода', 3),

      ...makePhrase(524, 632, 'Башня медленно проседает', 3),

      ...makePhrase(636, 690, 'Каждый год', 2),
      ...makePhrase(690, 748, 'ей пророчат падение', 2),

      ...makePhrase(752, 800, 'Но она стоит', 2),
      ...makePhrase(800, 856, 'и туристы рады', 2),

      ...makePhrase(860, 916, 'Инженеры тянут', 2),
      ...makePhrase(916, 976, 'тросы обратно', 2),

      ...makePhrase(976, 1024, 'Наклон всё ещё около четырёх градусов', 3),
    ]}
    top={1500}
    fontSize={78}
  />
);

const EndCard: React.FC<{ pal: ReturnType<typeof mixPalette> }> = ({ pal }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 13, stiffness: 90 } });
  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(180deg, rgba(20,12,24,0.86) 0%, rgba(20,12,24,0.55) 45%, rgba(20,12,24,0.86) 100%)',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' }),
      }}
    >
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontWeight: 900,
          fontSize: 118,
          color: '#FFFFFF',
          textAlign: 'center',
          lineHeight: 0.95,
          transform: `scale(${0.9 + s * 0.1})`,
          WebkitTextStroke: '3px rgba(0,0,0,0.35)',
        }}
      >
        ПИЗАНСКАЯ
        <br />
        БАШНЯ
      </div>
      <div
        style={{
          marginTop: 26,
          fontFamily: FONT_FAMILY,
          fontWeight: 700,
          fontSize: 40,
          color: '#FFE9C9',
          letterSpacing: '0.06em',
        }}
      >
        тестовая анимация · Remotion
      </div>
    </AbsoluteFill>
  );
};

export const PisaVideo: React.FC = () => {
  const frame = useCurrentFrame();

  // день → закат к сцене крупного плана
  const sunset = interpolate(frame, [250, 380], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pal = mixPalette(sunset);

  return (
    <AbsoluteFill style={{ backgroundColor: pal.skyTop }}>
      <svg width={VIDEO.width} height={VIDEO.height} viewBox={`0 0 ${VIDEO.width} ${VIDEO.height}`} style={{ position: 'absolute', inset: 0 }}>
        {frame < 292 && <SceneBuild pal={pal} />}
        {frame >= 292 && frame < 424 && <SceneTilt pal={pal} />}
        {frame >= 424 && frame < 524 && <SceneCloseup pal={pal} />}
        {frame >= 524 && frame < 632 && <SceneGround pal={pal} press={interpolate(frame, [524, 600], [0, 1], { extrapolateRight: 'clamp' })} />}
        {frame >= 632 && frame < 752 && <SceneSink pal={pal} />}
        {frame >= 752 && frame < 860 && <SceneFall pal={pal} />}
        {frame >= 860 && frame < 976 && <SceneTourists pal={pal} />}
        {frame >= 976 && <SceneCranes pal={pal} />}
      </svg>

      {frame < 1028 && <Captions />}
      {frame >= 1028 && <EndCard pal={pal} />}
    </AbsoluteFill>
  );
};
