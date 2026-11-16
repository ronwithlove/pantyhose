// UV-space rupture model shared by rendering, picking and interaction tests.
export const TEARS_PER_LEG=6;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function ruptureThreshold(strength=55){return .65+clamp(strength,0,100)*.022;}
export function accumulateRupture(state,strain,strength,dt){
  if(state.latched)return false;
  const excess=strain/ruptureThreshold(strength)-1;
  state.load=excess>0?state.load+Math.min(excess,4)*Math.min(dt,1/30)*5:Math.max(0,state.load-dt*4);
  if(state.load<1)return false;
  state.latched=true;state.load=0;return true;
}
export function createTear(uv,strain,seed=Math.random()){
  let n=(Math.floor(seed*0xffffffff)>>>0)||1;
  const random=()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return (n>>>0)/4294967296;};
  const size=clamp(.72+strain*.13,.8,1.6);
  return {u:(uv.x%1+1)%1,v:clamp(uv.y,.035,.965),rx:(.024+random()*.025)*size,ry:(.014+random()*.023)*size,
    phase:random()*6.2831853,up:.065+random()*.115,down:.025+random()*.075};
}
// Broad, low-amplitude variations keep an irregular oval without pointed lobes.
const OUTLINE_TWO=.055,OUTLINE_THREE=.025;
export function tearOutlineRadius(angle,phase){
  return 1+OUTLINE_TWO*Math.sin(angle*2+phase)+OUTLINE_THREE*Math.sin(angle*3-phase);
}
export function tearDistance(tear,uv){
  const dx=uv.x-tear.u,x=(dx-Math.round(dx))/tear.rx,y=(uv.y-tear.v)/tear.ry;
  const phase=tear.phase,c=Math.cos(phase*.16),s=Math.sin(phase*.16),px=c*x-s*y,py=s*x+c*y;
  const shape=(a,b,seed)=>Math.hypot(a,b)-tearOutlineRadius(Math.atan2(b,a),seed);
  return Math.min(shape(px,py,phase),shape((px-.18)/.36,(py-1.48)/.30,phase+2),shape((px+.25)/.16,(py-2.12)/.13,phase+4));
}
export function hasIntactFabric(tears,uv){return !uv||!tears.some(tear=>tearDistance(tear,uv)<0);}
// Four finite material spans around the grab, rather than mouse travel or a
// single triangle edge. Measures the change of length on the fitted garment.
export function grabStrain(shell,N,M){
  if(shell.pin===null)return 0;
  const stride=N+1,pin=shell.pin,row=Math.floor(pin/stride),col=pin%stride;
  const current=shell.fabric.geo.attributes.position.array,base=shell.fabric.rest,rest=shell.fitRest;
  let strain=0;
  for(const [dj,di]of [[8,0],[-8,0],[0,8],[0,-8]]){
    const j=clamp(row+dj,0,M),i=(col+di+N)%N,q=j*stride+i;
    let before=0,after=0;
    for(let c=0;c<3;c++){
      const d=rest[q*3+c]-rest[pin*3+c];
      const deformed=d+((current[q*3+c]-base[q*3+c])-(current[pin*3+c]-base[pin*3+c]))*shell.scale;
      before+=d*d;after+=deformed*deformed;
    }
    if(before>1e-8)strain=Math.max(strain,Math.sqrt(after/before)-1);
  }
  return strain;
}
export const TEAR_GLSL=`
float tearShape(vec2 p,float phase){
  float angle=atan(p.y,p.x);
  return length(p)-(1.0+${OUTLINE_TWO}*sin(angle*2.0+phase)+${OUTLINE_THREE}*sin(angle*3.0-phase));
}
float tearDistance(vec2 p,float phase){
  float c=cos(phase*.16),s=sin(phase*.16);
  p=vec2(c*p.x-s*p.y,s*p.x+c*p.y);
  return min(tearShape(p,phase),min(tearShape((p-vec2(.18,1.48))/vec2(.36,.30),phase+2.0),tearShape((p-vec2(-.25,2.12))/vec2(.16,.13),phase+4.0)));
}
`;
