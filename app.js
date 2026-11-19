import * as THREE from 'three';
import {bindTearAppearance} from './tear-appearance.js?v=20261119-language';
import { initializeLocalization, setLocalizedText, t } from './localization.js?v=20261119-language';
import { setupLighting } from './lighting-controls.js';
import { setupGroundShadows } from './ground-shadow.js';
import { createNylonMaterial, createStudioEnvironment } from './fabric-material.js?v=20261115-defaults2';
import { low, high } from './fabric-surface.js?v=20261115-contact1';
import { stretchResponse } from './fabric-math.js?v=20261115-contact1';
import { OrbitControls } from './vendor/OrbitControls.js';
import { loadAkaneCharacter } from './model-view.js?v=20261117-lower-body';
import { createCharacterStockings, setStockingInfluence } from './character-stockings.js?v=20261117-lower-body';

const $ = id => document.getElementById(id);
initializeLocalization();
const backgroundAudio = $('backgroundAudio');
const musicToggle = $('musicToggle');
backgroundAudio.volume = .28;

function syncMusicControl() {
  const playing = !backgroundAudio.paused;
  const key = playing ? 'musicPause' : 'musicPlay';
  const label = t(key);
  musicToggle.dataset.i18nAria = musicToggle.dataset.i18nTitle = key;
  musicToggle.setAttribute('aria-pressed', String(playing));
  musicToggle.setAttribute('aria-label', label);
  musicToggle.title = label;
}

function stopPageClickPlayback() {
  document.removeEventListener('click', playMusicOnPageClick, true);
}

function playBackgroundMusic() {
  backgroundAudio.play().then(stopPageClickPlayback, syncMusicControl);
}

function playMusicOnPageClick(event) {
  if (!event.isTrusted || musicToggle.contains(event.target) || !backgroundAudio.paused) return;
  playBackgroundMusic();
}

musicToggle.addEventListener('click', () => {
  stopPageClickPlayback();
  if (backgroundAudio.paused) playBackgroundMusic();
  else backgroundAudio.pause();
});
backgroundAudio.addEventListener('play', syncMusicControl);
backgroundAudio.addEventListener('pause', syncMusicControl);
document.addEventListener('click', playMusicOnPageClick, true);
playBackgroundMusic();
const canvas = $('scene');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false }); }
catch (e) { $('error').hidden=false; setLocalizedText($('error'), 'errorWebGL'); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x101414);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x101414,.065);
const characterGroup=new THREE.Group();characterGroup.name='Akane animated lower body';characterGroup.visible=false;scene.add(characterGroup);
let characterIdleMixer=null,characterIdleAction=null,characterIdlePlaying=true;
let characterStockings=null,stockingsEnabled=true;
const camera=new THREE.PerspectiveCamera(36,1,.05,50);
const controls=new OrbitControls(camera,canvas);
controls.enableRotate=true;controls.enablePan=false;controls.enableZoom=true;
controls.mouseButtons={LEFT:THREE.MOUSE.PAN,MIDDLE:THREE.MOUSE.PAN,RIGHT:THREE.MOUSE.ROTATE};
const ambientLight=new THREE.HemisphereLight(0xdce6e9,0x60564c,1.45);scene.add(ambientLight);
function light(color,power,x,y,z,size){const l=new THREE.DirectionalLight(color,power);l.position.set(x,y,z);scene.add(l);if(size){l.castShadow=true;l.shadow.mapSize.set(2048,2048);l.shadow.camera.left=-3;l.shadow.camera.right=3;l.shadow.camera.top=5;l.shadow.camera.bottom=-2;l.shadow.normalBias=.025;l.shadow.bias=-.0002;}return l;}
const studioLights=[light(0xffe6d7,2.6,-3,5,4,true),light(0xd4e3f5,1.6,3,3,-2),light(0xf6f4df,.6,1,1,4)];
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x202925,roughness:.93}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const podiumHeight=.06;const podium=new THREE.Mesh(new THREE.CylinderGeometry(1.35,1.38,podiumHeight,100),new THREE.MeshStandardMaterial({color:0x303a33,roughness:.8}));podium.position.y=.015;const podiumTop=podium.position.y+podiumHeight/2;podium.receiveShadow=true;scene.add(podium);
setupGroundShadows(studioLights[0], [floor, podium]);
const ring=new THREE.Mesh(new THREE.TorusGeometry(1.33,.002,6,160),new THREE.MeshBasicMaterial({color:0x62705e}));ring.rotation.x=-Math.PI/2;ring.position.y=.048;scene.add(ring);

const clothMat=createNylonMaterial(renderer);
bindTearAppearance(document,clothMat.userData.tearAppearance,setLocalizedText);
const environment=createStudioEnvironment(renderer);
clothMat.envMap=environment.texture;clothMat.envMapIntensity=.85;
let automatic=false,wire=false,drag=null,time=0,stiffness=55,elasticity=50,damping=50,lastTime=performance.now(),view='full',influenceRange=40,characterLoaded=false,viewAzimuth=0,viewPolar=0,viewDistance=0;
const viewRight=new THREE.Vector3(),viewUp=new THREE.Vector3();
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(),hit=new THREE.Vector3();
function screenRay(e){const b=canvas.getBoundingClientRect();pointer.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);raycaster.setFromCamera(pointer,camera);}
function updateStatus(){
  if(drag)return;
  const key=!characterLoaded?'statusLoading':!stockingsEnabled?'statusBare':automatic?'statusAuto':'statusReady';
  setLocalizedText($('status'),key);
}
function setAuto(value){
  automatic=value&&Boolean(characterStockings&&stockingsEnabled);
  $('auto').classList.toggle('active',automatic);$('auto').setAttribute('aria-pressed',automatic);
  if(!automatic){characterStockings?.shells.forEach(l=>l.goal.set(0,0,0));}
  updateStatus();
}
function pickFabricMeshes(){
  return stockingsEnabled?characterStockings?.meshes??[]:[];
}
canvas.addEventListener('pointerdown',e=>{
  if(document.body.dataset.editLights==='true'||e.button!==0||drag)return;
  const meshes=pickFabricMeshes();if(!meshes.length)return;
  screenRay(e);const h=raycaster.intersectObjects(meshes)[0];if(!h||!characterStockings.isIntactAt(h))return;
  setAuto(false);
  const l=characterStockings.grab(h,influenceRange);
  drag={leg:l,normal:l.grabNormal.clone(),origin:h.point.clone(),target:h.point.clone(),pointerId:e.pointerId};
  controls.enabled=false;
  plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),h.point);
  canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';
  setLocalizedText($('status'),'statusDragging');
},true);
canvas.addEventListener('pointerdown',e=>{if(e.button===0)e.stopImmediatePropagation();},true);
canvas.addEventListener('pointermove',e=>{
  if(document.body.dataset.editLights==='true')return;
  const meshes=pickFabricMeshes();if(!meshes.length)return;
  screenRay(e);
  if(drag&&e.pointerId===drag.pointerId){
    if(raycaster.ray.intersectPlane(plane,hit)){
      drag.target.copy(hit);

    }
    return;
  }
  const nearest=raycaster.intersectObjects(meshes)[0];
  canvas.style.cursor=nearest&&characterStockings.isIntactAt(nearest)?'grab':'default';
});
function release(e){
  if(!drag||e.pointerId!==drag.pointerId)return;
  cancelFabricDrag();canvas.style.cursor='default';updateStatus();
}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
addEventListener('blur',()=>{cancelFabricDrag();updateStatus();});
$('auto').onclick=()=>setAuto(!automatic);
$('wire').onclick=()=>{wire=!wire;clothMat.wireframe=wire;clothMat.opacity=wire?.25:Number($('opacity').value)/100;$('wire').classList.toggle('active',wire);$('wire').setAttribute('aria-pressed',wire);};
$('opacity').oninput=e=>{clothMat.opacity=e.target.value/100;$('opacityValue').value=e.target.value+'%';};
let fitTimer=null,fitRequest=0;
function showTightness(value,adjusting=false){
  const output=$('tightnessValue');
  output.value=value+'%';
  if(!adjusting)return;
  const progress=document.createElement('span');
  setLocalizedText(progress,'tightnessAdjusting');
  output.append(' · ',progress);
}
$('tightness').oninput=e=>{
  const value=Number(e.target.value),request=++fitRequest;
  showTightness(value,true);clearTimeout(fitTimer);
  fitTimer=setTimeout(async()=>{
    try {
      const applied=await characterStockings?.requestTightness(value);
      if(request===fitRequest&&applied)showTightness(value);
    }catch(error){
      if(request!==fitRequest)return;
      console.error(error);$('tightness').value=characterStockings.tightness;
      showTightness(characterStockings.tightness);setLocalizedText($('tightnessHint'),'tightnessFailure');
    }
  },120);
};
$('elasticity').oninput=e=>{elasticity=Number(e.target.value);$('elasticityValue').value=elasticity+'%';};
$('damping').oninput=e=>{damping=Number(e.target.value);$('dampingValue').value=damping+'%';};
$('stiffness').oninput=e=>{stiffness=Number(e.target.value);$('stiffnessValue').value=e.target.value+'%';};
$('influence').oninput=e=>{influenceRange=Number(e.target.value);$('influenceValue').value=influenceRange+'%';characterStockings?.shells.forEach(l=>{if(l.pin!==null)setStockingInfluence(l,l.pin,influenceRange,new THREE.Vector2(l.fabric.pinAngle/(2*Math.PI),(l.fabric.pinY-low)/(high-low)));});};
for(const id of ['reflection','sparkle']){
  $(id).oninput=e=>{const value=Number(e.target.value);clothMat.userData.reflectionControls[id].value=value/100;$(id+'Value').value=value+'%';};
}
const palettes={pearl:[0x686773,'pearl'],ink:[0x25242a,'ink'],rose:[0x79514b,'rose']};
document.querySelectorAll('.swatch').forEach(el=>el.onclick=()=>{document.querySelectorAll('.swatch').forEach(e=>e.classList.toggle('active',e===el));const p=palettes[el.dataset.color];clothMat.color.setHex(p[0]);setLocalizedText($('colorName'),p[1]);});
function frameView(next){
  view=next;const mobile=innerWidth<=700;document.body.dataset.view=view;camera.clearViewOffset();
  if(mobile&&view==='ankle')camera.setViewOffset(innerWidth,innerHeight,0,127,innerWidth,innerHeight);
  camera.updateProjectionMatrix();
  if(view==='ankle'){camera.position.set(.06,.58,mobile?2.15:2);controls.target.set(0,.42,0);}
  else if(view==='detail'){camera.position.set(mobile?9.2:5.8,mobile?1.2:1.7,.05);controls.target.set(0,mobile?.9:1.62,0);}
  else{camera.position.set(.05,mobile?1.2:1.72,mobile?9.2:6.2);controls.target.set(0,mobile?.9:1.66,0);}
  document.querySelectorAll('.views button[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
  controls.minAzimuthAngle=-Infinity;controls.maxAzimuthAngle=Infinity;controls.minPolarAngle=0;controls.maxPolarAngle=Math.PI;controls.minDistance=0;controls.maxDistance=Infinity;
  controls.update();viewAzimuth=controls.getAzimuthalAngle();viewPolar=controls.getPolarAngle();viewDistance=controls.getDistance();
  viewRight.set(1,0,0).applyQuaternion(camera.quaternion).normalize();viewUp.set(0,1,0).applyQuaternion(camera.quaternion).normalize();
  const radians=Math.PI/180;controls.minAzimuthAngle=viewAzimuth-25*radians;controls.maxAzimuthAngle=viewAzimuth+25*radians;
  controls.minPolarAngle=viewPolar-19.6*radians;controls.maxPolarAngle=viewPolar+16*radians;
  controls.minDistance=Math.max(.05,viewDistance-1.15);controls.maxDistance=Math.max(controls.minDistance,viewDistance-.12);
  const fixedPan=viewRight.clone().multiplyScalar(.10).addScaledVector(viewUp,.65);camera.position.add(fixedPan);controls.target.add(fixedPan);controls.update();
}
// Keep the cursor target in world space while the grabbed attachment follows Idle.
function updateDragGoal(){
  if(!drag)return;
  characterStockings.grabFrame(drag.leg,drag.origin,drag.normal);
  const response=stretchResponse(elasticity),limit=response.maxDistance*drag.leg.scale;
  const goal=drag.leg.goal.copy(drag.target).sub(drag.origin).multiplyScalar(response.gain).clampLength(0,limit);
  const dot=goal.dot(drag.normal);if(dot<0)goal.addScaledVector(drag.normal,-dot);
  goal.addScaledVector(drag.normal,Math.min(.18*drag.leg.scale,goal.length()*.3)).clampLength(0,limit);
}
function syncIdleUi(){
  const ready=Boolean(characterIdleAction);
  $('idleToggle').disabled=!ready;
  setLocalizedText($('idleToggle'),!ready?'idleUnavailable':characterIdlePlaying?'idlePause':'idlePlay');
  $('idleToggle').setAttribute('aria-pressed',String(characterIdlePlaying));
  $('stockingsToggle').disabled=!characterStockings;
  setLocalizedText($('stockingsToggle'),stockingsEnabled?'stockingsHide':'stockingsShow');
  $('stockingsToggle').setAttribute('aria-pressed',String(stockingsEnabled));
  setLocalizedText($('staticNoticeText'),!characterLoaded?'noticeLoading':stockingsEnabled?'noticeReady':'noticeBare');
  const lighting=document.querySelector('[data-panel="lights"]').classList.contains('active');
  $('fabricControls').hidden=lighting||!characterStockings||!stockingsEnabled;
  updateStatus();
}
function cancelFabricDrag(){
  if(!drag)return;
  const pointerId=drag.pointerId;
  drag.leg.goal.set(0,0,0);
  drag=null;
  controls.enabled=true;
  if(canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);
}
$('idleToggle').onclick=()=>{if(!characterIdleAction)return;characterIdlePlaying=!characterIdlePlaying;characterIdleAction.paused=!characterIdlePlaying;syncIdleUi();};
$('stockingsToggle').onclick=()=>{
  if(!characterStockings)return;
  cancelFabricDrag();setAuto(false);stockingsEnabled=!stockingsEnabled;
  characterStockings.setVisible(stockingsEnabled);canvas.style.cursor='default';syncIdleUi();
};
document.body.dataset.modelMode='character';$('panel').dataset.model='character';syncIdleUi();
document.querySelectorAll('.views button[data-view]').forEach(el=>el.onclick=()=>frameView(el.dataset.view));
$('damage').onclick=()=>{
  if(!characterStockings)return;
  characterStockings.tearingEnabled=!characterStockings.tearingEnabled;
  characterStockings.shells.forEach(s=>s.rupture.load=0);
  $('damage').setAttribute('aria-pressed',String(characterStockings.tearingEnabled));
  $('damage').classList.toggle('active',characterStockings.tearingEnabled);
};
$('tearStrength').oninput=e=>{if(characterStockings)characterStockings.tearStrength=Number(e.target.value);$('tearStrengthValue').value=e.target.value+'%';};
$('repair').onclick=()=>{characterStockings?.repair();setLocalizedText($('damageHint'),'damageHintText');};
$('reset').onclick=()=>{cancelFabricDrag();characterStockings?.reset();$('repair').onclick();controls.enabled=true;time=0;frameView('ankle');setAuto(false);};
const panel=$('panel'),panelToggle=$('panelToggle');
let lastMobile=innerWidth<=700;
function setPanelCollapsed(collapsed){panel.dataset.collapsed=String(collapsed);panelToggle.setAttribute('aria-expanded',String(!collapsed));setLocalizedText(panelToggle,collapsed?'panelOpen':'panelClose');}
panelToggle.onclick=()=>setPanelCollapsed(panel.dataset.collapsed!=='true');
setPanelCollapsed(lastMobile);
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;if((w<=700)||lastMobile!==(w<=700)){lastMobile=w<=700;setPanelCollapsed(lastMobile);frameView(view);}else{camera.clearViewOffset();camera.updateProjectionMatrix();}}
addEventListener('resize',resize);resize();frameView('ankle');
setupLighting({scene,camera,renderer,orbit:controls,lights:studioLights,ambient:ambientLight,clothMaterial:clothMat,showScene:()=>{
  cancelFabricDrag();setAuto(false);controls.target.set(0,2,0);camera.position.set(7,5,12);controls.maxDistance=30;
  if(innerWidth<=700)camera.position.set(9,7,22);
  controls.update();document.body.dataset.view='lighting';document.querySelectorAll('.views button[data-view]').forEach(b=>b.classList.remove('active'));
},canUseFabric:()=>Boolean(characterStockings&&stockingsEnabled),isStaticModel:()=>true});
let maxDisplacement=0;
let frames=0,fps=60,frameStart=performance.now();
function animate(now){
  requestAnimationFrame(animate);const dt=Math.min((now-lastTime)/1000,1/30);lastTime=now;time+=dt;
  if(characterIdlePlaying)characterIdleMixer?.update(dt);
  characterGroup.updateMatrixWorld(true);updateDragGoal();
  if(automatic){
    const cycle=time%6.8;
    const pull=cycle<1?0:cycle<2.6?THREE.MathUtils.smoothstep(cycle,1,2.6):cycle<4.2?1:cycle<4.35?1-(cycle-4.2)/.15:0;
    if(characterStockings&&stockingsEnabled){
      characterStockings.automaticPull(pull,influenceRange,elasticity);
    }
  }
  maxDisplacement=0;
  if(characterStockings&&stockingsEnabled){
    const ruptured=characterStockings.update(dt,stiffness,damping);
    if(ruptured.length){
      if(drag&&ruptured.includes(drag.leg))cancelFabricDrag();
      setAuto(false);canvas.style.cursor='default';setLocalizedText($('damageHint'),'damageDone');
    }
    maxDisplacement=Math.max(...characterStockings.shells.map(l=>l.displacement.length()));
  }
  controls.update();renderer.render(scene,camera);frames++;
  if(now-frameStart>1000){
    fps=frames*1000/(now-frameStart);canvas.dataset.fps=Math.round(fps);
    canvas.dataset.influenceRange=String(influenceRange);
    canvas.dataset.elasticity=String(elasticity);canvas.dataset.damping=String(damping);
    canvas.dataset.animationTime=(characterIdleMixer?.time??0).toFixed(3);canvas.dataset.dragging=String(Boolean(drag));
    canvas.dataset.damage=String(characterStockings?.shells.reduce((n,s)=>n+s.tears.length,0)??0);
    const geometries=characterStockings?.meshes.map(m=>m.geometry)??[];
    canvas.dataset.finite=String(geometries.every(g=>g.attributes.position.array.every(Number.isFinite)));
    canvas.dataset.displacement=maxDisplacement.toFixed(5);canvas.dataset.stockings=String(Boolean(characterStockings&&stockingsEnabled));
    frames=0;frameStart=now;
  }
}
loadAkaneCharacter().then(({model,idleClip,dimensions})=>{
  characterGroup.add(model);characterGroup.position.y=podiumTop;
  characterStockings=createCharacterStockings(model,characterGroup,clothMat);
  characterLoaded=true;
  if(idleClip){characterIdleMixer=new THREE.AnimationMixer(model);characterIdleAction=characterIdleMixer.clipAction(idleClip);characterIdleAction.setLoop(THREE.LoopRepeat,Infinity).play();}
  characterGroup.visible=true;
  canvas.dataset.modelHeight=dimensions.height.toFixed(2);canvas.dataset.modelWidth=dimensions.width.toFixed(2);canvas.dataset.modelDepth=dimensions.depth.toFixed(2);
  frameView(view);syncIdleUi();console.info('Akane and fitted stockings loaded',dimensions);
}).catch(error=>{
  console.error('Unable to load character and stockings',error);$('error').hidden=false;
  setLocalizedText($('error'),'errorModel');setLocalizedText($('status'),'errorStatus');
});
requestAnimationFrame(animate);
