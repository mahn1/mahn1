import { Config } from '@remotion/cli/config';

// Браузер можно подставить снаружи (см. scripts/render-local.mjs),
// иначе Remotion возьмёт свой обычный Chrome.
const exec = process.env.REMOTION_BROWSER_EXECUTABLE;
if (exec) Config.setBrowserExecutable(exec);

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
