import * as THREE from 'three';
import { ankleFold, pullRadii, pullDistance, pullInfluence } from './fabric-math.js';

// The original procedural stocking kernel, retained for the character adapter.
// A continuous cross-section surface: foot, ankle, calf, knee and thigh.
export const profile=[ // y, x radius, z radius, x shift, z shift
[.055,.12,.22,0,.15],[.10,.16,.31,0,.20],[.18,.17,.34,0,.20],
[.30,.145,.27,0,.12],[.43,.112,.145,0,.015],[.60,.12,.13,-.005,0],
[.88,.16,.18,-.015,-.02],[1.18,.225,.23,-.018,-.035],[1.42,.237,.24,-.015,-.02],
[1.65,.19,.185,-.045,.02],[1.87,.18,.18,-.06,.065],[2.02,.205,.205,-.055,.035],
[2.25,.235,.24,-.025,.005],[2.55,.28,.275,.008,0],[2.85,.315,.30,.035,0],[3.22,.34,.32,.05,0]];
export function shape(y){let j=0;while(j<profile.length-2 && y>profile[j+1][0])j++;const b=profile[j],c=profile[j+1],a=profile[Math.max(j-1,0)],d=profile[Math.min(j+2,profile.length-1)],t=THREE.MathUtils.clamp((y-b[0])/(c[0]-b[0]),0,1);const v=[];for(let i=1;i<5;i++){const m0=(c[i]-a[i])/(c[0]-a[0])*(c[0]-b[0]),m1=(d[i]-b[i])/(d[0]-b[0])*(c[0]-b[0]);v.push((2*t**3-3*t*t+1)*b[i]+(t**3-2*t*t+t)*m0+(-2*t**3+3*t*t)*c[i]+(t**3-t*t)*m1);}return v;}
export const N=96,M=256,low=.056,high=3.22;
// Concentrate vertical subdivisions at the ankle to resolve millimeter-scale folds.
export const rows=Array.from({length:M+1},(_,j)=>{const t=j/M;return t<.5?low+(.9-low)*t*2:.9+(high-.9)*(t-.5)*2;});
export function makeLeg(side,offset){const pos=[],uv=[],indices=[];for(let j=0;j<=M;j++){const y=rows[j];const [rx,rz,cx,cz]=shape(y);for(let i=0;i<=N;i++){const a=i/N*Math.PI*2;pos.push(side*(.355+cx)+(rx+offset)*Math.cos(a),y,cz+(rz+offset)*Math.sin(a));uv.push(i/N,(y-low)/(high-low));}}for(let j=0;j<M;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i,b=a+N+1;indices.push(a,b,a+1,b,b+1,a+1);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;}

export function createFabricState(side) {
  const geo=makeLeg(side,.003);
  for(const name of ['fabricCompression','fabricStretch'])geo.setAttribute(name,new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count),1).setUsage(THREE.DynamicDrawUsage));
  const folds=new Float32Array(geo.attributes.position.count);
  for(let j=0;j<=M;j++)for(let i=0;i<=N;i++)folds[j*(N+1)+i]=ankleFold(rows[j],i/N*Math.PI*2);
  return {side,geo,folds,rest:geo.attributes.position.array.slice(),pinY:2.45,pinAngle:.3,displacement:new THREE.Vector3(),velocity:new THREE.Vector3(),goal:new THREE.Vector3()};
}

export function advanceFabricSpring(l,dt,stiffness,dampingRatio=.67){const spring=35+stiffness*1.8,damping=2*Math.sqrt(spring)*dampingRatio; // Damped elastic response; collision-constrained procedural deformation.
for(let k=0;k<3;k++){const key=['x','y','z'][k];l.velocity[key]+=((l.goal[key]-l.displacement[key])*spring-l.velocity[key]*damping)*dt;l.displacement[key]+=l.velocity[key]*dt;}
}

export function deformFabric(l,dt,stiffness,influenceRange,dampingRatio=.67){advanceFabricSpring(l,dt,stiffness,dampingRatio);
const p=l.geo.attributes.position.array,r=l.rest,amp=l.displacement.length();
const pinnedRadius=shape(l.pinY)[0],radii=pullRadii(influenceRange);
for(let j=0;j<=M;j++){const y=rows[j],[rx,rz,cx,cz]=shape(y);const verticalOffset=y-l.pinY;const dy=verticalOffset/radii.vertical;for(let i=0;i<=N;i++){const a=i/N*Math.PI*2,k=(j*(N+1)+i)*3;let da=Math.atan2(Math.sin(a-l.pinAngle),Math.cos(a-l.pinAngle));const d=pullDistance(verticalOffset,da*pinnedRadius,radii);const influence=pullInfluence(d)*(l.anchor?l.anchor[j*(N+1)+i]:1);if(l.influence)l.influence[j*(N+1)+i]=influence;let x=r[k]+l.displacement.x*influence,yy=r[k+1]+l.displacement.y*influence,z=r[k+2]+l.displacement.z*influence;
// Small radial folds follow the pull and disappear continuously at rest.
const fold=l.folds[k/3]/(1+amp*influence*14);
l.geo.attributes.fabricStretch.array[k/3]=amp*influence*2+(l.prestretch?l.prestretch[k/3]:0);
l.geo.attributes.fabricCompression.array[k/3]=fold/.0052;
const wrinkle=(fold+amp*.013*Math.sin(da*31+dy*12)*Math.sin(Math.min(1,d)*Math.PI)*Math.max(0,1-d))*(l.anchor?l.anchor[j*(N+1)+i]:1);
x+=Math.cos(a)*wrinkle;z+=Math.sin(a)*wrinkle;
if(influence>0){const [crx,crz,ccx,ccz]=shape(THREE.MathUtils.clamp(yy,low,high));const center=l.side*(.355+ccx),dx=x-center,dz=z-ccz;const q=Math.sqrt((dx/(crx+.002))**2+(dz/(crz+.002))**2);if(q<1&&q>1e-6){x=center+dx/q;z=ccz+dz/q;}}
p[k]=x;p[k+1]=yy;p[k+2]=z;}}
l.geo.attributes.fabricCompression.needsUpdate=true;l.geo.attributes.fabricStretch.needsUpdate=true;l.geo.attributes.position.needsUpdate=true;if(!l.skipNormals)l.geo.computeVertexNormals();return amp;}
