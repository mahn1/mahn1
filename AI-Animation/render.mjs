import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url)); process.chdir(root);
const storyPath=process.argv[2] || 'story.example.json', out=resolve(process.argv[3] || 'output.mp4');
const story=JSON.parse(await readFile(storyPath,'utf8'));
if (!Array.isArray(story.scenes) || !story.scenes.length || story.scenes.some(s=>typeof s.text!=='string'||!s.text.trim())) throw Error('Нужен непустой массив scenes с текстом.');
function run(cmd,args) {const r=spawnSync(cmd,args,{stdio:'inherit'});if(r.error) throw r.error;if(r.status!==0) throw Error(`${cmd} завершился с ошибкой ${r.status}`)}
function duration(file) {const r=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',file],{encoding:'utf8'});if(r.error||r.status!==0||!Number.isFinite(+r.stdout)||+r.stdout<=0) throw Error(`Не удалось узнать длительность ${file}`);return +r.stdout}
const work=resolve('.render'); await mkdir(work,{recursive:true});
const scenes=[];
for(let i=0;i<story.scenes.length;i++) {
 const s=story.scenes[i], audio=resolve(work,`voice-${i}.mp3`);
 if(s.audio) {const source=resolve(dirname(resolve(storyPath)),s.audio);if(!existsSync(source)) throw Error(`Нет аудио: ${source}`); scenes.push({...s,audio:source});}
 else {run(process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3'),['tts.py','--voice',story.voice || 'Егор Тихонов','--text',s.text,'--output',audio]);scenes.push({...s,audio})}
 scenes[i].frames=Math.ceil((duration(scenes[i].audio)+.25)*30);
}
const total=scenes.reduce((a,s)=>a+s.frames,0); if(total>1800) throw Error(`Видео длиннее 60 секунд (${(total/30).toFixed(1)} с). Сократите сценарий.`);
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const path=resolve(root,pathname==='/'?'public/index.html':pathname.startsWith('/node_modules/')?'.'+pathname:'public'+pathname);if(!path.startsWith(root+'/')) throw Error('forbidden'); const data=await readFile(path);res.writeHead(200,{'Content-Type':extname(path)==='.js'?'text/javascript':'text/html'});res.end(data)}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r)); let browser;
try {
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader']}); const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.sceneReady);
 const frames=join(work,'frames'); await rm(frames,{recursive:true,force:true});await mkdir(frames,{recursive:true}); let n=0;
 for(const s of scenes) for(let f=0;f<s.frames;f++){await page.evaluate(({s,t})=>window.drawFrame(s,t),{s,t:f/30});await page.screenshot({path:join(frames,`${String(n++).padStart(6,'0')}.png`)});if(n%150===0) console.log(`Кадры: ${n}/${total}`)}
 const args=['-y','-framerate','30','-i',join(frames,'%06d.png')]; for(const s of scenes) args.push('-i',s.audio);
 const filter=scenes.map((s,i)=>`[${i+1}:a]aresample=48000,apad,atrim=duration=${s.frames/30},asetpts=PTS-STARTPTS[a${i}]`).join(';')+';'+scenes.map((_,i)=>`[a${i}]`).join('')+`concat=n=${scenes.length}:v=0:a=1[a]`;
 args.push('-filter_complex',filter,'-map','0:v','-map','[a]','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',out);run('ffmpeg',args);console.log(`Готово: ${out}`);
} finally {if(browser) await browser.close();server.close()}
