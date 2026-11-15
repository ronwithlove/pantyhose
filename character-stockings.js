import * as THREE from 'three';
import { fittedRestState } from './stocking-fit.js?v=20261115-contact1';
import { N, M, low, high, rows, createFabricState, deformFabric } from './fabric-surface.js?v=20261115-fit3';
import { stretchResponse, reboundDamping } from './fabric-math.js?v=20261115-elasticity';

const GAP=.003;
const STRIDE=N+1;
const GRID_COUNT=STRIDE*(M+1);
const point=new THREE.Vector3(),normal=new THREE.Vector3();
const matrix=new THREE.Matrix4(),skinMatrix=new THREE.Matrix4();

function mixSamples(a,b,t){
  const weights=new Map();
  for(const [id,w]of a)weights.set(id,w*(1-t));
  for(const [id,w]of b)weights.set(id,(weights.get(id)||0)+w*t);
  return [...weights].filter(([,w])=>w>1e-9);
}

function skinWeights(body,samples){
  const values=new Map(),indices=body.geometry.attributes.skinIndex,weights=body.geometry.attributes.skinWeight;
  for(const [id,factor]of samples)for(let k=0;k<4;k++){
    const bone=indices.getComponent(id,k),w=weights.getComponent(id,k)*factor;
    if(w>0)values.set(bone,(values.get(bone)||0)+w);
  }
  const sorted=[...values].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=sorted.reduce((n,[,w])=>n+w,0);
  if(sum<=0)throw new Error('Missing stocking skin weights.');
  while(sorted.length<4)sorted.push([0,0]);
  return {indices:sorted.map(([i])=>i),weights:sorted.map(([,w])=>w/sum)};
}

// Exact linear-blend skin transform used by Three.js, expressed in the requested
// coordinate system. Its inverse fits a regular fabric vertex without changing
// the original body, skeleton or bind pose.
function weightedSkinMatrix(body,indices,weights,toSpace,target){
  target.elements.fill(0);
  for(let k=0;k<4;k++)if(weights[k]){
    matrix.multiplyMatrices(body.skeleton.bones[indices[k]].matrixWorld,body.skeleton.boneInverses[indices[k]]);
    for(let j=0;j<16;j++)target.elements[j]+=matrix.elements[j]*weights[k];
  }
  target.premultiply(body.bindMatrixInverse).multiply(body.bindMatrix).premultiply(toSpace);
  return target;
}

function crossSection(triangles,rest,y){
  const segments=[];
  for(const ids of triangles){
    const ys=ids.map(i=>rest[i].y);
    if(y<Math.min(...ys)||y>=Math.max(...ys))continue;
    const cuts=[];
    for(let k=0;k<3;k++){
      const a=ids[k],b=ids[(k+1)%3],pa=rest[a],pb=rest[b];
      if((pa.y<=y&&pb.y>y)||(pb.y<=y&&pa.y>y)){
        const t=(y-pa.y)/(pb.y-pa.y);
        cuts.push({point:pa.clone().lerp(pb,t),samples:[[a,1-t],[b,t]]});
      }
    }
    if(cuts.length===2)segments.push(cuts);
  }
  return segments;
}

function toeEnvelope(segments){
  // Near the sole, the body contour splits into individual toes/contact islands.
  // A stocking spans those islands rather than wrapping each toe separately.
  const unique=new Map();
  for(const end of segments.flat())unique.set(`${end.point.x.toFixed(7)},${end.point.z.toFixed(7)}`,end);
  const points=[...unique.values()].sort((a,b)=>a.point.x-b.point.x||a.point.z-b.point.z);
  const cross=(a,b,c)=>(b.point.x-a.point.x)*(c.point.z-a.point.z)-(b.point.z-a.point.z)*(c.point.x-a.point.x);
  const lower=[],upper=[];
  for(const p of points){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
  for(const p of points.slice().reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
  const hull=lower.slice(0,-1).concat(upper.slice(0,-1));
  return hull.map((p,i)=>[p,hull[(i+1)%hull.length]]);
}

function intersectContour(segments,cx,cz,dx,dz){
  let outer=null,distance=-Infinity;
  for(const [a,b]of segments){
    const sx=b.point.x-a.point.x,sz=b.point.z-a.point.z;
    const denominator=dx*sz-dz*sx;
    if(Math.abs(denominator)<1e-12)continue;
    const ox=a.point.x-cx,oz=a.point.z-cz;
    const ray=(ox*sz-oz*sx)/denominator,t=(ox*dz-oz*dx)/denominator;
    // Outermost intersection bridges the toe gaps like a stocking toe pocket.
    if(ray>=0&&t>=-1e-7&&t<=1+1e-7&&ray>distance){
      const f=THREE.MathUtils.clamp(t,0,1);
      distance=ray;outer={point:a.point.clone().lerp(b.point,f),samples:mixSamples(a.samples,b.samples,f)};
    }
  }
  return outer;
}

function createFittedStocking(body,side,parent,rest,restNormals,bodyToLocal){
  const sign=side==='l'?1:-1,skinIndices=body.geometry.attributes.skinIndex,skinWeight=body.geometry.attributes.skinWeight;
  const boneSet=new Set(body.skeleton.bones.flatMap((b,i)=>/^(thigh|calf|foot|ball)/.test(b.name)&&b.name.endsWith(`_${side}`)?[i]:[]));
  const belongs=rest.map((_,i)=>{let sum=0;for(let k=0;k<4;k++)if(boneSet.has(skinIndices.getComponent(i,k)))sum+=skinWeight.getComponent(i,k);return sum>.6;});
  const triangles=[],index=body.geometry.index,count=index?index.count:rest.length;
  for(let i=0;i<count;i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);if(ids.every(id=>belongs[id]))triangles.push(ids);}
  const toLocal=new THREE.Matrix4().copy(parent.matrixWorld).invert();
  const bonePosition=name=>body.skeleton.bones.find(b=>b.name===name)?.getWorldPosition(new THREE.Vector3()).applyMatrix4(toLocal);
  const thigh=bonePosition(`thigh_${side}`),knee=bonePosition(`calf_${side}`),ankle=bonePosition(`foot_${side}`);
  if(!thigh||!knee||!ankle||!triangles.length)throw new Error(`Cannot fit original stocking to ${side} leg.`);
  const sole=Math.min(...rest.filter((_,i)=>belongs[i]).map(p=>p.y));
  const bottom=sole-GAP,height=THREE.MathUtils.lerp(knee.y,thigh.y,.77),scale=(height-bottom)/(high-low);
  const fabric=createFabricState(sign);fabric.skipNormals=true;
  // The old reference had authored ring folds; a fitted, tensioned stocking does not.
  fabric.folds.fill(0);
  fabric.anchor=new Float32Array(GRID_COUNT);fabric.influence=new Float32Array(GRID_COUNT);
  const fitRest=new Float32Array((GRID_COUNT+1)*3),binding=[],inverseBind=[],smoothNormals=[];
  let soleHit;
  const centers=[],radii=new Float32Array(GRID_COUNT),fittedRows=[];
  const addVertex=(hit,yOverride=null)=>{
    normal.set(0,0,0);for(const [id,w]of hit.samples)normal.addScaledVector(restNormals[id],w);normal.normalize();
    const fitted=hit.point.clone().addScaledVector(normal,GAP);if(yOverride!==null)fitted.y=yOverride;
    const weights=skinWeights(body,hit.samples),i=binding.length;
    weightedSkinMatrix(body,weights.indices,weights.weights,bodyToLocal,skinMatrix);
    // A normal transforms by inverse-transpose, so the reverse operation is A^T.
    smoothNormals.push(normal.clone().applyMatrix3(new THREE.Matrix3().setFromMatrix4(skinMatrix).transpose()).normalize());
    inverseBind.push(skinMatrix.clone().invert());binding.push(weights);fitted.toArray(fitRest,i*3);
    return fitted;
  };
  for(let j=0;j<=M;j++){
    const y=bottom+(rows[j]-low)*scale;
    let segments=crossSection(triangles,rest,Math.max(sole+.0015,y));
    if(y<ankle.y+.08){
      // Dilate the toe pocket vertically as well as around its contour. A single
      // horizontal slice misses nail tips and steep toe surfaces between rows.
      const clearance=.012*(1-THREE.MathUtils.smoothstep(y,ankle.y,ankle.y+.08));
      for(const offset of [-clearance,clearance])for(const segment of crossSection(triangles,rest,Math.max(sole+.0015,y+offset))){
        segments.push(segment.map(end=>({...end,point:end.point.clone().setY(Math.max(sole+.0015,y))})));
      }
      segments=toeEnvelope(segments);
    }
    if(!segments.length)throw new Error(`No ${side} leg contour at stocking row ${j}.`);
    const pts=segments.flatMap(s=>s.map(p=>p.point));
    const cx=(Math.min(...pts.map(p=>p.x))+Math.max(...pts.map(p=>p.x)))/2;
    const cz=(Math.min(...pts.map(p=>p.z))+Math.max(...pts.map(p=>p.z)))/2;
    centers.push(new THREE.Vector3(cx,y,cz));fittedRows.push(y);
    for(let i=0;i<=N;i++){
      const angle=(i%N)/N*Math.PI*2;
      const hit=intersectContour(segments,cx,cz,Math.cos(angle),Math.sin(angle));
      if(!hit)throw new Error(`Cannot fit ${side} stocking row ${j}, angle ${i}.`);
      if(j===0&&i===0)soleHit=hit;
      const p=addVertex(hit,j===0?bottom:null);
      const toeEase=.004*(1-THREE.MathUtils.smoothstep(y,ankle.y,ankle.y+.08));
      p.x+=Math.cos(angle)*toeEase;p.z+=Math.sin(angle)*toeEase;p.toArray(fitRest,(j*STRIDE+i)*3);
      radii[j*STRIDE+i]=Math.hypot(p.x-cx,p.z-cz);
      // Only the actual cuff attachment is new; all free fabric uses the original formula.
      fabric.anchor[j*STRIDE+i]=THREE.MathUtils.smoothstep(high-rows[j],0,.07);
    }
  }
  // The original tube's underside gets a small closed sole; its 96 x 256 lattice
  // and all UVs above that cap are unchanged.
  const capPoint=new THREE.Vector3(centers[0].x,bottom,centers[0].z);
  const capHit=soleHit;
  addVertex({...capHit,point:capPoint},bottom);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array((GRID_COUNT+1)*3),3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(new Float32Array((GRID_COUNT+1)*3),3).setUsage(THREE.DynamicDrawUsage));
  const uv=Array.from(fabric.geo.attributes.uv.array);uv.push(.5,0);
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setAttribute('fabricDamage',new THREE.Float32BufferAttribute(new Float32Array((GRID_COUNT+1)*2).fill(10),2));
  const toeCoverage=new Float32Array(GRID_COUNT+1);
  for(let i=0;i<GRID_COUNT;i++)toeCoverage[i]=(1-THREE.MathUtils.smoothstep(fitRest[i*3+1],ankle.y-.015,ankle.y+.04))*THREE.MathUtils.smoothstep(fitRest[i*3+2]-ankle.z,.10,.22);
  geometry.setAttribute('fabricToe',new THREE.Float32BufferAttribute(toeCoverage,1));
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(binding.flatMap(b=>b.indices),4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(binding.flatMap(b=>b.weights),4));
  for(const name of ['fabricStretch','fabricCompression'])geometry.setAttribute(name,new THREE.Float32BufferAttribute(new Float32Array(GRID_COUNT+1),1).setUsage(THREE.DynamicDrawUsage));
  const indices=Array.from(fabric.geo.index.array);for(let i=0;i<N;i++)indices.push(GRID_COUNT,i,i+1);geometry.setIndex(indices);
  const mesh=new THREE.SkinnedMesh(geometry);
  mesh.name=`Stocking_${side}`;mesh.position.copy(body.position);mesh.quaternion.copy(body.quaternion);mesh.scale.copy(body.scale);
  mesh.bindMode=body.bindMode;mesh.bind(body.skeleton,body.bindMatrix);mesh.renderOrder=2;mesh.frustumCulled=false;
  body.parent.add(mesh);
  const shell={mesh,fabric,height,bottom,scale,fitRest,binding,inverseBind,smoothNormals,centers,radii,fittedRows,
    ankleHeight:ankle.y,kneeHeight:knee.y,grabRestPoint:new THREE.Vector3(),grabRestNormal:new THREE.Vector3(),damageCenter:null,
    goal:new THREE.Vector3(),displacement:new THREE.Vector3(),grabNormal:new THREE.Vector3(),pin:null,range:40,
    influence:fabric.influence,baseGeometryNormals:null,dirty:false};
  mesh.userData.stocking=shell;
  return shell;
}

function stitchNormals(geometry){
  const n=geometry.attributes.normal;
  for(let j=0;j<=M;j++){
    const a=j*STRIDE,b=a+N;
    point.fromBufferAttribute(n,a).add(normal.fromBufferAttribute(n,b)).normalize();
    n.setXYZ(a,point.x,point.y,point.z);n.setXYZ(b,point.x,point.y,point.z);
  }
}

// Adapt the original radial collision projection to the fitted leg contour.
// This is a projection of the whole pull, not a separate per-vertex direction clamp.
function projectOutsideBody(s,p){
  if(p.y>s.height)return;
  p.y=Math.max(p.y,s.bottom);
  let lo=0,hi=M;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(s.fittedRows[mid]<=p.y)lo=mid;else hi=mid;}
  const t=THREE.MathUtils.clamp((p.y-s.fittedRows[lo])/(s.fittedRows[hi]-s.fittedRows[lo]),0,1);
  const cx=THREE.MathUtils.lerp(s.centers[lo].x,s.centers[hi].x,t),cz=THREE.MathUtils.lerp(s.centers[lo].z,s.centers[hi].z,t);
  const dx=p.x-cx,dz=p.z-cz,r=Math.hypot(dx,dz);
  if(r<1e-8)return;
  const u=((Math.atan2(dz,dx)/(2*Math.PI)+1)%1)*N,i=Math.floor(u),f=u-i;
  const a=THREE.MathUtils.lerp(s.radii[lo*STRIDE+i],s.radii[lo*STRIDE+i+1],f);
  const b=THREE.MathUtils.lerp(s.radii[hi*STRIDE+i],s.radii[hi*STRIDE+i+1],f);
  const boundary=THREE.MathUtils.lerp(a,b,t);
  if(r<boundary){p.x=cx+dx*boundary/r;p.z=cz+dz*boundary/r;}
}

function writeFittedGeometry(s){
  const p=s.mesh.geometry.attributes.position;
  const canonical=s.fabric.geo.attributes.position.array,rest=s.fabric.rest;
  const moving=s.fabric.displacement.lengthSq()>1e-12;

  for(let i=0;i<GRID_COUNT;i++){
    const k=i*3;

    point.fromArray(s.fitRest,k);
    point.x+=(canonical[k]-rest[k])*s.scale;point.y+=(canonical[k+1]-rest[k+1])*s.scale;point.z+=(canonical[k+2]-rest[k+2])*s.scale;
    const relaxed=1/(1+s.fabric.displacement.length()*s.influence[i]*14);
    if(s.fitState){const o=s.fitState.offsets;point.x+=o[k]*relaxed;point.y+=o[k+1]*relaxed;point.z+=o[k+2]*relaxed;}
    if(s.fitState||(moving&&s.influence[i]>0))projectOutsideBody(s,point);
    point.applyMatrix4(s.inverseBind[i]);p.setXYZ(i,point.x,point.y,point.z);
  }
  point.fromArray(s.fitRest,GRID_COUNT*3).applyMatrix4(s.inverseBind[GRID_COUNT]);p.setXYZ(GRID_COUNT,point.x,point.y,point.z);
  p.needsUpdate=true;
  const geometry=s.mesh.geometry;
  geometry.computeVertexNormals();stitchNormals(geometry);
  if(!s.baseGeometryNormals){
    s.baseGeometryNormals=geometry.attributes.normal.array.slice();
    // A toe pocket spans the toes: its normals must not reproduce nail grooves.
    for(let i=0;i<GRID_COUNT;i++)if(s.fitRest[i*3+1]<s.ankleHeight+.025)s.smoothNormals[i].fromBufferAttribute(geometry.attributes.normal,i);

  }
  const baseNormal=new THREE.Vector3(),currentNormal=new THREE.Vector3(),rotation=new THREE.Quaternion();
  for(let i=0;i<GRID_COUNT;i++){
    const k=i*3,n=geometry.attributes.normal.array,base=s.baseGeometryNormals;
    if(n[k]===base[k]&&n[k+1]===base[k+1]&&n[k+2]===base[k+2]){
      const original=s.smoothNormals[i];geometry.attributes.normal.setXYZ(i,original.x,original.y,original.z);continue;
    }
    baseNormal.fromArray(s.baseGeometryNormals,k);currentNormal.fromBufferAttribute(geometry.attributes.normal,i);
    rotation.setFromUnitVectors(baseNormal,currentNormal);
    point.copy(s.smoothNormals[i]).applyQuaternion(rotation).normalize();
    geometry.attributes.normal.setXYZ(i,point.x,point.y,point.z);
  }
  stitchNormals(geometry);geometry.attributes.normal.needsUpdate=true;
  for(const name of ['fabricStretch','fabricCompression']){
    geometry.attributes[name].array.set(s.fabric.geo.attributes[name].array);
    if(name==='fabricCompression'&&s.fitState)for(let i=0;i<GRID_COUNT;i++)geometry.attributes[name].array[i]+=s.fitState.compression[i]/(1+s.fabric.displacement.length()*s.influence[i]*14);
    geometry.attributes[name].needsUpdate=true;
  }
  if(!moving)s.restPositions=p.array.slice();
  // SkinnedMesh raycast bounds otherwise remain cached at an old pose.
  s.mesh.boundingSphere=null;s.mesh.boundingBox=null;
}

function poseMap(s,body,target){
  const i=s.pin??Math.floor(M*.75)*STRIDE;
  const binding=s.binding[i];
  weightedSkinMatrix(body,binding.indices,binding.weights,body.matrixWorld,target);
  return target.multiply(s.inverseBind[i]);
}

// Ray picking matches the shader cutout so an empty hole cannot be grabbed.
export function hasFabricAtUv(shell,uv){
  if(!shell.damageCenter||!uv)return true;
  const dx=uv.x-shell.damageCenter.x,x=(dx-Math.round(dx))/.045,y=(uv.y-shell.damageCenter.y)/.032;
  const r=Math.hypot(x,y),ragged=.045*Math.sin(uv.x*1900)+.035*Math.sin(uv.y*2700);
  const thread=(uv.y*1400)%1>=.94;
  return r+ragged>=1||(r>=.84&&thread);
}

export function setStockingInfluence(shell,seed,range,uv=null){
  shell.pin=Math.min(GRID_COUNT-1,seed);shell.range=range;
  const j=Math.floor(shell.pin/STRIDE),i=shell.pin%STRIDE;
  shell.fabric.pinY=uv?low+uv.y*(high-low):rows[j];
  shell.fabric.pinAngle=(uv?uv.x:i/N)*Math.PI*2;
}

export function createCharacterStockings(model,parent,material){
  const body=model.getObjectByName('SK_AKANE_BODY_FULL');
  if(!body?.isSkinnedMesh)throw new Error('A complete skinned body is required.');
  parent.updateMatrixWorld(true);
  const bodyToLocal=new THREE.Matrix4().copy(parent.matrixWorld).invert().multiply(body.matrixWorld);
  const rest=[],restNormals=[],sourceNormal=body.geometry.attributes.normal,sourcePosition=body.geometry.attributes.position;
  const localGap=GAP/bodyToLocal.getMaxScaleOnAxis();
  for(let i=0;i<sourcePosition.count;i++){
    const p=body.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(bodyToLocal);
    point.fromBufferAttribute(sourcePosition,i).addScaledVector(normal.fromBufferAttribute(sourceNormal,i),localGap);
    body.applyBoneTransform(i,point).applyMatrix4(bodyToLocal).sub(p).normalize();
    rest.push(p);restNormals.push(point.clone());
  }
  const shells=['l','r'].map(side=>createFittedStocking(body,side,parent,rest,restNormals,bodyToLocal));
  for(const s of shells){s.mesh.material=material;deformFabric(s.fabric,0,55,40);writeFittedGeometry(s);}
  const map=new THREE.Matrix4(),deltaMatrix=new THREE.Matrix3();
  let fitWorker=null,finishFit=null;
  const applyFit=(value,states)=>{
    system.tightness=value;
    for(let i=0;i<shells.length;i++){
      const s=shells[i];s.fitState=states[i];
      s.fabric.folds.fill(0);s.fabric.prestretch=s.fitState.tension;s.dirty=true;
    }
  };
  const cancelFit=()=>{fitWorker?.terminate();fitWorker=null;finishFit?.(false);finishFit=null;};
  const system={lastGrab:null,tightness:55,
    setTightness(value){
      cancelFit();value=Math.max(0,Math.min(100,value));
      applyFit(value,shells.map(s=>fittedRestState(s,N,M,value)));
    },
    requestTightness(value){
      cancelFit();value=Math.max(0,Math.min(100,value));
      if(typeof Worker==='undefined'){this.setTightness(value);return Promise.resolve(true);}
      // Keep rendering and skeletal animation running during rest-shape relaxation.
      return new Promise((resolve,reject)=>{
        finishFit=resolve;
        try {
          const worker=fitWorker=new Worker(new URL('./stocking-fit-worker.js?v=20261115-contact1',import.meta.url),{type:'module'});
          worker.onmessage=({data})=>{
            if(fitWorker!==worker)return;
            if(data.error){worker.onerror({message:data.error});return;}
            applyFit(value,data.states);worker.terminate();fitWorker=null;finishFit=null;resolve(true);
          };
          worker.onerror=error=>{if(fitWorker!==worker)return;worker.terminate();fitWorker=null;finishFit=null;reject(new Error(error.message||'Fit worker failed'));};
          const inputs=shells.map(s=>({fitRest:s.fitRest,fittedRows:s.fittedRows,centers:s.centers.map(c=>({x:c.x,z:c.z})),radii:s.radii,
            height:s.height,ankleHeight:s.ankleHeight,kneeHeight:s.kneeHeight,fabric:{side:s.fabric.side}}));
          worker.postMessage({inputs,N,M,value});
        }catch(error){fitWorker?.terminate();fitWorker=null;finishFit=null;reject(error);}
      });
    },shells,meshes:shells.map(s=>s.mesh),visible:true,
    isIntactAt(hit){return hasFabricAtUv(hit.object.userData.stocking,hit.uv);},
    setVisible(value){this.visible=value;this.meshes.forEach(m=>m.visible=value);this.reset();},
    reset(){for(const s of shells){s.goal.set(0,0,0);s.displacement.set(0,0,0);s.fabric.goal.set(0,0,0);s.fabric.displacement.set(0,0,0);s.fabric.velocity.set(0,0,0);s.pin=null;s.dirty=true;}},
    isSettling(){return shells.some(s=>s.fabric.displacement.lengthSq()>1e-8||s.goal.lengthSq()>1e-8||s.fabric.velocity.lengthSq()>1e-7);},
    grab(hit,range){
      const s=hit.object.userData.stocking;this.reset();
      const uv=hit.uv??new THREE.Vector2(.5,0);
      let row=0;const y=low+uv.y*(high-low);
      for(let j=1;j<=M;j++)if(Math.abs(rows[j]-y)<Math.abs(rows[row]-y))row=j;
      setStockingInfluence(s,row*STRIDE+Math.round(uv.x*N),range,uv);
      // Raycaster face normals already use the skinned triangle positions.
      s.grabNormal.copy(hit.face.normal).transformDirection(s.mesh.matrixWorld);
      poseMap(s,body,map);
      s.grabRestPoint.copy(hit.point).applyMatrix4(map.clone().invert());
      s.grabRestNormal.copy(s.grabNormal).applyMatrix3(new THREE.Matrix3().setFromMatrix4(map).transpose()).normalize();
      this.lastGrab={shell:s,uv:uv.clone()};
      return s;
    },
    grabFrame(s,origin,outNormal){
      parent.updateMatrixWorld(true);poseMap(s,body,map);
      origin.copy(s.grabRestPoint).applyMatrix4(map);
      outNormal.copy(s.grabRestNormal).applyMatrix3(new THREE.Matrix3().getNormalMatrix(map)).normalize();
    },
    damageLastGrab(){
      const {shell:s,uv}=this.lastGrab??{shell:shells[0],uv:new THREE.Vector2(.25,.42)};
      // One recoverable hole per stocking; coordinates remain attached to the fabric.
      s.damageCenter=uv.clone();const attr=s.mesh.geometry.attributes.fabricDamage,tex=s.mesh.geometry.attributes.uv;
      for(let i=0;i<attr.count;i++){
        const d=tex.getX(i)-uv.x,wrapped=d-Math.round(d);
        attr.setXY(i,wrapped/.045,(tex.getY(i)-uv.y)/.032);
      }
      attr.needsUpdate=true;return true;
    },
    repair(){for(const s of shells){s.damageCenter=null;s.mesh.geometry.attributes.fabricDamage.array.fill(10);s.mesh.geometry.attributes.fabricDamage.needsUpdate=true;}},
    automaticPull(pull,range,elasticity=50){
      const s=shells[0];if(s.pin===null){let row=0;for(let j=1;j<=M;j++)if(Math.abs(rows[j]-2.48)<Math.abs(rows[row]-2.48))row=j;setStockingInfluence(s,row*STRIDE+4,range,new THREE.Vector2(.25/(2*Math.PI),(2.48-low)/(high-low)));}
      parent.updateMatrixWorld(true);
      deltaMatrix.setFromMatrix4(poseMap(s,body,map));
      const response=stretchResponse(elasticity);
      s.goal.set(.88*pull,.13*pull,.17*pull).multiplyScalar(response.gain).clampLength(0,response.maxDistance).multiplyScalar(s.scale).applyMatrix3(deltaMatrix);
      return s;
    },
    update(dt,stiffness,damping=50){
      parent.updateMatrixWorld(true);
      for(const s of shells){
        s.mesh.boundingSphere=null;s.mesh.boundingBox=null;
        // Idle is handled by the original GPU skeleton; stationary fabric needs
        // no CPU re-fitting or geometry uploads on each animation frame.
        if(!s.dirty&&s.goal.lengthSq()===0&&s.fabric.displacement.lengthSq()===0&&s.fabric.velocity.lengthSq()===0)continue;
        s.dirty=false;
        deltaMatrix.setFromMatrix4(poseMap(s,body,map));
        const prestretch=s.fitState?.tension[s.pin??0]??0;
        // Tight, pre-stretched fabric resists lifting; this affects manual and automatic pulls alike.
        s.fabric.goal.copy(s.goal).applyMatrix3(deltaMatrix.clone().invert()).divideScalar(s.scale*(1+prestretch*2));
        deformFabric(s.fabric,dt,stiffness,s.range,reboundDamping(damping));
        if(s.goal.lengthSq()===0&&s.fabric.displacement.lengthSq()<1e-8&&s.fabric.velocity.lengthSq()<1e-7){s.fabric.displacement.set(0,0,0);s.fabric.velocity.set(0,0,0);deformFabric(s.fabric,0,stiffness,s.range);}
        s.displacement.copy(s.fabric.displacement).multiplyScalar(s.scale).applyMatrix3(deltaMatrix);
        writeFittedGeometry(s);
      }
    }
  };
  system.setTightness(55);system.update(0,55);
  return system;
}
