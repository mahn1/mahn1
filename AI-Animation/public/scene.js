import * as THREE from '/node_modules/three/build/three.module.js';
const renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
renderer.setSize(innerWidth,innerHeight); renderer.setPixelRatio(1); document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();const camera=new THREE.OrthographicCamera(-3.375,3.375,6,-6,.1,100); camera.position.z=20;
const material=c=>new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide});
function rect(parent,x,y,z,w,h,c,rot=0){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material(c));m.position.set(x,y,z);m.rotation.z=rot;parent.add(m);return m}
function circle(parent,x,y,z,r,c){const m=new THREE.Mesh(new THREE.CircleGeometry(r,40),material(c));m.position.set(x,y,z);parent.add(m);return m}
function poly(parent,points,z,color){const shape=new THREE.Shape();shape.moveTo(...points[0]);points.slice(1).forEach(p=>shape.lineTo(...p));shape.closePath();const m=new THREE.Mesh(new THREE.ShapeGeometry(shape),material(color));m.position.z=z;parent.add(m);return m}
function group(){const g=new THREE.Group();scene.add(g);return g}
const sky=group(); const skybg=rect(sky,0,0,-8,20,20,'#a4cbdc');
const clouds=[];for(let i=0;i<8;i++){const c=circle(sky,0,0,-6,.52+(i%3)*.16,'#e4edf1');c.userData={x:(i%4)*2.4-3.8,y:4.2-Math.floor(i/4)*2.5,speed:.07+i*.018};clouds.push(c)}
const ocean=group();rect(ocean,0,-4.9,-5,14,3,'#20546e');for(let i=0;i<8;i++)rect(ocean,-3+i*.95,-4.1-(i%3)*.5,-4.8,.6,.025,'#8dc1d0');
const plane=group();
// Silhouette viewed from the side, with a thick outline.
poly(plane,[[-2.65,.22],[1.35,.28],[2.55,.07],[2.85,-.13],[2.45,-.34],[-2.45,-.34],[-2.8,-.12]],0,'#1b2c3e');
poly(plane,[[-2.55,.13],[1.35,.18],[2.48,.02],[2.65,-.13],[2.38,-.23],[-2.37,-.23],[-2.63,-.1]],.1,'#f4f4ea');
poly(plane,[[-1.9,.15],[-2.6,1.05],[-2.12,1.05],[-1.14,.15]],.1,'#f4f4ea');
poly(plane,[[-.4,-.16],[-1.4,-.95],[-.75,-.95],[.8,-.18]],.15,'#c3d8df');
rect(plane,.6,-.12,.2,2.8,.05,'#db6b51');for(let i=0;i<9;i++)circle(plane,-1.3+i*.34,.02,.21,.065,'#24465a');
const storm=group();poly(storm,[[-.6,2.2],[.25,2.2],[-.1,1.3],[.45,1.3],[-.65,-.1],[-.35,.95],[-.85,.95]],2,'#f6e8a3');
const cockpit=group();rect(cockpit,0,0,-1,10,14,'#25394b');
poly(cockpit,[[-3,3.8],[3,3.8],[2.45,1],[-2.45,1]],0,'#819eaa');rect(cockpit,0,2.3,.1,.16,3,'#263746');
rect(cockpit,0,-.8,.2,7,1.25,'#172637');for(let i=0;i<5;i++)circle(cockpit,-2+i, -.8,.3,.18,i===1?'#e45e4b':'#94b5c2');
function stickman(x){const g=new THREE.Group();cockpit.add(g);g.position.set(x,-.7,1);circle(g,0,1.2,0,.58,'#1b242b');circle(g,0,1.2,.1,.51,'#f5f3e9');for(const dx of [-.17,.17])circle(g,dx,1.26,.2,.05,'#1b242b');rect(g,0,.15,.1,.12,1.1,'#151d24');rect(g,-.47,.0,.1,.10,1.2,'#151d24',-.7);rect(g,.47,0,.1,.10,1.2,'#151d24',.7);return g}
const pilot1=stickman(-1.25),pilot2=stickman(1.25);
const splash=group();for(let i=0;i<10;i++){const a=Math.PI*(.12+i*.085);rect(splash,Math.cos(a)*1.2,-3.65+Math.sin(a)*.6,1,.11,1.25,'#cdeef3',a-Math.PI/2)}
const rescue=group();poly(rescue,[[-1.8,-3.85],[1.65,-3.85],[1.15,-4.35],[-1.2,-4.35]],2,'#f4f2e5');rect(rescue,0,-3.58,2.1,1.2,.52,'#f4f2e5');rect(rescue,.2,-3.5,2.2,.52,.2,'#6b99a8');
const badge=document.querySelector('.badge'),subtitle=document.querySelector('.subtitle');
window.drawFrame=(data,t)=>{
 const shot=data.shot||'flight'; const dark=['storm','cockpit','fall','impact'].includes(shot);
 skybg.material.color.set(dark?'#344759':shot==='rescue'?'#d7a68a':'#a4cbdc');
 clouds.forEach(c=>{c.position.set(((c.userData.x-t*c.userData.speed+12)%12)-6,c.userData.y,-6);c.material.color.set(dark?'#576675':'#e4edf1')});
 ocean.visible=['fall','impact','rescue'].includes(shot); cockpit.visible=shot==='cockpit';plane.visible=['flight','storm','fall','impact'].includes(shot);storm.visible=shot==='storm' && Math.floor(t*1.8)%3===0;splash.visible=shot==='impact';rescue.visible=shot==='rescue';
 plane.position.set(shot==='fall'?.4-Math.min(t*.22,1.4):0,shot==='impact'?-3.35:shot==='fall'?1.3-Math.min(t*.45,3):.9+Math.sin(t*1.2)*.12,0);
 plane.rotation.z=shot==='fall'?-.38-Math.min(t*.035,.2):shot==='impact'?-.1:Math.sin(t*.8)*.035;
 plane.scale.setScalar(shot==='impact'?.72:1);pilot1.rotation.z=Math.sin(t*5)*.025;pilot2.rotation.z=-pilot1.rotation.z;
 splash.scale.setScalar(Math.min(1, .2+t*.8)); rescue.position.x=Math.sin(t*.5)*.12;
 camera.position.x=Math.sin(t*.25)*.09; camera.position.y=Math.sin(t*.3)*.06;
 badge.textContent=shot==='rescue'?'ВЫМЫШЛЕННАЯ ИСТОРИЯ':'ВЫМЫШЛЕННЫЙ РЕЙС'; subtitle.textContent=data.text||'';
 renderer.render(scene,camera);
};
window.drawFrame({shot:'flight',text:''},0);window.sceneReady=true;
