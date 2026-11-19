import * as THREE from '/node_modules/three/build/three.module.js';
const renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(1); document.body.prepend(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#d9f3ff');
const camera = new THREE.OrthographicCamera(-3.375,3.375,6,-6,.1,100); camera.position.set(0,0,20); camera.lookAt(0,0,0);
const mat = color => new THREE.MeshBasicMaterial({color});
function box(x,y,z,w,h,color) {const o=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat(color)); o.position.set(x,y,z); scene.add(o);return o}
box(0,-3,-5,15,6,'#6ac9df'); box(0,-5,-4,15,2,'#2ba1c2');
box(-2.3,1,-6,2.5,0.3,'#ffffff'); box(2.1,2.5,-6,2.3,0.3,'#ffffff');
// Each limb rotates about its shoulder/hip, so the poses remain connected.
const person = new THREE.Group(); person.position.set(0,-.7,0); scene.add(person);
function line(x1,y1,x2,y2,width,parent=person) {const dx=x2-x1,dy=y2-y1; const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,Math.hypot(dx,dy)),mat('#171717'));mesh.position.set((x1+x2)/2,(y1+y2)/2,.1);mesh.rotation.z=-Math.atan2(dx,dy);parent.add(mesh);return mesh}
function limb(x,y,length) {const pivot=new THREE.Group();pivot.position.set(x,y,0);person.add(pivot);line(0,0,0,-length,.12,pivot);return pivot}
line(0,1,0,-1.1,.16);const la=limb(-.02,.65,1.7),ra=limb(.02,.65,1.7),ll=limb(-.03,-1.05,1.8),rl=limb(.03,-1.05,1.8);
const head=new THREE.Mesh(new THREE.CircleGeometry(.72,48),mat('#151515'));head.position.set(0,1.75,.1);person.add(head);
const face=new THREE.Mesh(new THREE.CircleGeometry(.65,48),mat('#ffffff'));face.position.set(0,1.75,.2);person.add(face);
for(const x of [-.23,.23]) {const eye=new THREE.Mesh(new THREE.CircleGeometry(.06,16),mat('#151515'));eye.position.set(x,1.88,.3);person.add(eye)}
const mouth=line(-.16,1.52,.16,1.52,.05); mouth.position.z=.3;
window.drawFrame = (data, t) => {
  const wave=Math.sin(t*3);la.rotation.z=.55+wave*.15;ra.rotation.z=-.75+wave*.24;ll.rotation.z=.22;rl.rotation.z=-.22;
  person.position.x=Math.sin(t*.5)*.08; mouth.scale.y=data.emotion==='surprised' ? 2 : 1;
  document.querySelector('.subtitle').textContent=data.text;
  renderer.render(scene,camera);
};
window.drawFrame({text:'',emotion:'talk'},0); window.sceneReady=true;
