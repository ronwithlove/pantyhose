import * as THREE from 'three';

export function setupLighting({scene,camera,renderer,orbit,lights,ambient,clothMaterial,showScene,canUseFabric=()=>true,isStaticModel=()=>false}) {
  const $=id=>document.getElementById(id),canvas=renderer.domElement;
  const defaults=lights.map(l=>({position:l.position.clone(),color:l.color.clone(),intensity:l.intensity}));
  const ambientDefault={color:ambient.color.clone(),intensity:ambient.intensity};
  const environmentDefault=clothMaterial.envMapIntensity;
  let selected=0,editing=false,drag=null;
  const group=new THREE.Group();group.visible=false;scene.add(group);
  const markers=lights.map((light,index)=>{
    const m=new THREE.Mesh(new THREE.SphereGeometry(.12,16,12),new THREE.MeshBasicMaterial({color:light.color,depthTest:false}));
    m.renderOrder=10;m.userData.lightIndex=index;group.add(m);
    const geometry=new THREE.BufferGeometry().setFromPoints([light.position,light.target.position]);
    const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:light.color,transparent:true,opacity:.5,depthTest:false}));
    line.renderOrder=9;group.add(line);return {m,line};
  });
  function updateMarkers(){lights.forEach((l,i)=>{const {m,line}=markers[i];m.position.copy(l.position);m.material.color.copy(l.color);m.scale.setScalar(i===selected?1.4:1);line.material.color.copy(l.color);const a=line.geometry.attributes.position;a.setXYZ(0,l.position.x,l.position.y,l.position.z);a.setXYZ(1,l.target.position.x,l.target.position.y,l.target.position.z);a.needsUpdate=true;line.geometry.computeBoundingSphere();});}
  function sync(){const l=lights[selected];$('lightSelect').value=String(selected);$('lightPower').value=l.intensity;$('lightPowerValue').value=l.intensity.toFixed(2);$('lightColor').value='#'+l.color.getHexString();for(const axis of ['x','y','z']){$('light'+axis.toUpperCase()).value=l.position[axis];$('light'+axis.toUpperCase()+'Value').value=l.position[axis].toFixed(1);}updateMarkers();}
  function end(e){if(!drag||(e&&e.pointerId!==drag.id))return;const id=drag.id;drag=null;orbit.enabled=true;if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);canvas.style.cursor='default';}
  function setEditing(value){end();editing=value;group.visible=value;document.body.dataset.editLights=String(value);$('moveLights').classList.toggle('active',value);$('moveLights').setAttribute('aria-pressed',value);if(value)showScene();updateMarkers();}
  $('lightSelect').onchange=e=>{selected=Number(e.target.value);sync();};
  $('lightPower').oninput=e=>{lights[selected].intensity=Number(e.target.value);$('lightPowerValue').value=Number(e.target.value).toFixed(2);};
  $('lightColor').oninput=e=>{lights[selected].color.set(e.target.value);updateMarkers();};
  for(const axis of ['x','y','z'])$('light'+axis.toUpperCase()).oninput=e=>{lights[selected].position[axis]=Number(e.target.value);sync();};
  $('ambientPower').oninput=e=>{ambient.intensity=Number(e.target.value);$('ambientPowerValue').value=ambient.intensity.toFixed(2);};
  $('ambientColor').oninput=e=>ambient.color.set(e.target.value);
  $('environmentPower').oninput=e=>{clothMaterial.envMapIntensity=Number(e.target.value);$('environmentPowerValue').value=clothMaterial.envMapIntensity.toFixed(2);};
  $('moveLights').onclick=()=>setEditing(!editing);
  $('resetLights').onclick=()=>{end();lights.forEach((l,i)=>{l.position.copy(defaults[i].position);l.color.copy(defaults[i].color);l.intensity=defaults[i].intensity;});ambient.color.copy(ambientDefault.color);ambient.intensity=ambientDefault.intensity;clothMaterial.envMapIntensity=environmentDefault;syncAmbient();sync();};
  function syncAmbient(){$('ambientPower').value=ambient.intensity;$('ambientPowerValue').value=ambient.intensity.toFixed(2);$('ambientColor').value='#'+ambient.color.getHexString();$('environmentPower').value=clothMaterial.envMapIntensity;$('environmentPowerValue').value=clothMaterial.envMapIntensity.toFixed(2);}
  document.querySelectorAll('[data-panel]').forEach(button=>button.onclick=()=>{const lighting=button.dataset.panel==='lights';$('fabricControls').hidden=lighting||!canUseFabric();$('staticNotice').hidden=lighting||!isStaticModel();$('lightControls').hidden=!lighting;document.querySelectorAll('[data-panel]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});if(!lighting)setEditing(false);});
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(),point=new THREE.Vector3();
  function cast(e){const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);}
  canvas.addEventListener('pointerdown',e=>{if(!editing||e.button!==0||drag)return;cast(e);const hit=ray.intersectObjects(markers.map(x=>x.m))[0];if(!hit)return;selected=hit.object.userData.lightIndex;const l=lights[selected];plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),l.position);if(!ray.ray.intersectPlane(plane,point))return;drag={id:e.pointerId,offset:l.position.clone().sub(point)};orbit.enabled=false;canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';sync();},true);
  canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;cast(e);if(ray.ray.intersectPlane(plane,point)){lights[selected].position.copy(point).add(drag.offset).clamp(new THREE.Vector3(-6,.2,-6),new THREE.Vector3(6,7,6));sync();}});
  canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',end);
  window.addEventListener('blur',()=>end());
  syncAmbient();sync();
}
