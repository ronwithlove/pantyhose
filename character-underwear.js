import * as THREE from 'three';

// Fitted opaque briefs in the original character coordinate system.
// The mask is evaluated BEFORE skinning, so its cut lines travel with the body.
const CUT = {
  // Lower the waistband and raise the front gusset to match the supplied guide.
  waist: 1.96,
  crotch: 1.78,
};

export function createCharacterUnderwear(model) {
  const body=model.getObjectByName('SK_AKANE_BODY_FULL');
  if(!body?.isSkinnedMesh)throw new Error('Underwear requires the skinned Akane body.');
  model.updateMatrixWorld(true);
  const positions=body.geometry.attributes.position;
  const rest=new Float32Array(positions.count*3);
  const point=new THREE.Vector3();
  const pelvis=body.skeleton.bones.find(b=>b.name==='pelvis');
  if(!pelvis)throw new Error('Underwear requires a pelvis bone.');
  const pelvisPosition=pelvis.getWorldPosition(new THREE.Vector3());
  // Remove the root translation (e.g. podium height), retaining normalized scale.
  const rootY=model.parent?model.parent.getWorldPosition(new THREE.Vector3()).y:0;
  for(let i=0;i<positions.count;i++){
    body.getVertexPosition(i,point).applyMatrix4(body.matrixWorld);
    point.x-=pelvisPosition.x;point.y-=rootY;point.z-=pelvisPosition.z;
    point.toArray(rest,i*3);
  }
  // Keep pelvic triangles near the cuts. Fragment clipping gives smooth hems.
  const sourceIndex=body.geometry.index,sourceCount=sourceIndex?sourceIndex.count:positions.count;
  const selected=[];
  for(let i=0;i<sourceCount;i+=3){
    const ids=[0,1,2].map(k=>sourceIndex?sourceIndex.getX(i+k):i+k);
    const ys=ids.map(id=>rest[id*3+1]),low=Math.min(...ys),high=Math.max(...ys);
    if(high>=CUT.crotch&&low<=CUT.waist+.05)selected.push(...ids);
  }
  if(!selected.length)throw new Error('No pelvic surface found for the briefs.');
  const geometry=new THREE.BufferGeometry(),remap=new Map(),sourceIds=[];
  geometry.setIndex(selected.map(id=>{
    if(!remap.has(id)){remap.set(id,sourceIds.length);sourceIds.push(id);}
    return remap.get(id);
  }));
  for(const name of ['position','normal','uv','skinIndex','skinWeight']){
    const attribute=body.geometry.getAttribute(name),values=[];
    for(const id of sourceIds)for(let k=0;k<attribute.itemSize;k++)values.push(attribute.getComponent(id,k));
    const ArrayType=attribute.array.constructor;
    geometry.setAttribute(name,new THREE.BufferAttribute(new ArrayType(values),attribute.itemSize,attribute.normalized));
  }
  geometry.setAttribute('garmentRest',new THREE.Float32BufferAttribute(sourceIds.flatMap(id=>Array.from(rest.subarray(id*3,id*3+3))),3));
  const restPosition=new THREE.Vector3(),direction=new THREE.Vector3(),offsetPosition=new THREE.Vector3();
  for(let i=0;i<sourceIds.length;i++){
    const sourceId=sourceIds[i];
    point.fromBufferAttribute(geometry.attributes.position,i);
    direction.fromBufferAttribute(geometry.attributes.normal,i).normalize();
    // The glTF mesh transform can differ from its skinned geometry's unit scale.
    body.getVertexPosition(sourceId,restPosition).applyMatrix4(body.matrixWorld);
    offsetPosition.copy(point).add(direction);
    body.applyBoneTransform(sourceId,offsetPosition).applyMatrix4(body.matrixWorld);
    const skinScale=offsetPosition.distanceTo(restPosition);
    if(skinScale>0)point.addScaledVector(direction,.0035/skinScale);
    geometry.attributes.position.setXYZ(i,point.x,point.y,point.z);
  }
  const material=new THREE.MeshStandardMaterial({
    name:'Opaque black underwear',color:0x101114,roughness:.88,metalness:0,
    side:THREE.DoubleSide,transparent:false,depthWrite:true,
  });
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      attribute vec3 garmentRest;
      varying vec3 vGarmentRest;
    `).replace('#include <begin_vertex>',`#include <begin_vertex>
      vGarmentRest=garmentRest;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vGarmentRest;
    `).replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      float x=abs(vGarmentRest.x);
      float y=vGarmentRest.y;
      // Full rear coverage, higher leg openings on the front, continuous side band.
      float front=smoothstep(-0.08,0.10,vGarmentRest.z);
      float legOpening=${CUT.crotch.toFixed(3)}+mix(0.50,0.62,front)*x;
      float waistband=${CUT.waist.toFixed(3)}+0.04*clamp(x/0.35,0.0,1.0);
      bool briefs=y>=legOpening&&y<=waistband;
      if(!briefs)discard;
    `);
  };
  material.customProgramCacheKey=()=> 'akane-black-briefs';
  const mesh=new THREE.SkinnedMesh(geometry,material);
  mesh.name='Akane_black_underwear';
  mesh.position.copy(body.position);mesh.quaternion.copy(body.quaternion);mesh.scale.copy(body.scale);
  mesh.bindMode=body.bindMode;mesh.bind(body.skeleton,body.bindMatrix);
  mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;
  mesh.renderOrder=1;
  // Decoration only: never enters stocking picking or deformation.
  mesh.raycast=()=>{};
  body.parent.add(mesh);
  return mesh;
}
