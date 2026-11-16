import * as THREE from 'three';
import {createTearAppearance} from './tear-appearance.js?v=20261115-defaults2';
import {TEARS_PER_LEG,TEAR_GLSL} from './fabric-tearing.js?v=20261115-round1';

// Knit-scale normal and roughness maps, generated once with stable fiber variation.
// Mipmaps and anisotropic filtering average subpixel fibers instead of shimmering.
function fiberMaps(renderer) {
  const size=256, height=new Float32Array(size*size), noise=new Float32Array(size*size);
  const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const row=Math.floor(y/16),v=(y%16)/16,u=((x+(row%2)*8)%16)/16;
    const curve=.18+.27*Math.sin(v*Math.PI),d=Math.min(Math.abs(u-curve),Math.abs(u-(1-curve)));
    const yarn=Math.exp(-d*d/ .008)*( .65+.35*Math.sin(v*Math.PI));
    height[y*size+x]=yarn;noise[y*size+x]=hash(Math.floor(x/2),Math.floor(y/3));
  }
  const normal=new Uint8Array(size*size*4),detail=new Uint8Array(size*size*4);
  const h=(x,y)=>height[((y+size)%size)*size+(x+size)%size];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=y*size+x,k=i*4,dx=(h(x-1,y)-h(x+1,y))*.85,dy=(h(x,y-1)-h(x,y+1))*.85;
    const n=new THREE.Vector3(dx,dy,1).normalize();
    normal.set([Math.round((n.x*.5+.5)*255),Math.round((n.y*.5+.5)*255),Math.round((n.z*.5+.5)*255),255],k);
    // R: yarn coverage, G: roughness, B: stable filament highlights.
    detail.set([Math.round((.65+height[i]*.35)*255),Math.round((.32+.25*(1-height[i])+.12*noise[i])*255),Math.round(noise[i]*255),255],k);
  }
  const texture=data=>{const t=new THREE.DataTexture(data,size,size);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(10,32);t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.anisotropy=renderer.capabilities.getMaxAnisotropy();t.needsUpdate=true;return t;};
  return {normal:texture(normal),detail:texture(detail)};
}

export function createNylonMaterial(renderer) {
  const maps=fiberMaps(renderer);
  const material=new THREE.MeshPhysicalMaterial({
    color:0x25242a,roughness:.7,roughnessMap:maps.detail,
    normalMap:maps.normal,normalScale:new THREE.Vector2(.38,.28),
    transparent:true,opacity:.42,side:THREE.DoubleSide,depthWrite:false,
    metalness:0,ior:1.46,specularIntensity:1.0,
    sheen:.16,sheenColor:new THREE.Color(0xb9bbc5),sheenRoughness:.38,
    anisotropy:.65,anisotropyRotation:Math.PI*.5,
  });
  // Shared uniform objects survive shader recompilation and update without rebuilding.
  material.userData.reflectionControls={reflection:{value:1},sparkle:{value:1}};
  material.userData.tearAppearance=createTearAppearance();
  material.userData.tears={holes:{value:Array.from({length:TEARS_PER_LEG*2},()=>new THREE.Vector4())},details:{value:Array.from({length:TEARS_PER_LEG*2},()=>new THREE.Vector4())}};
  material.onBeforeCompile=shader=>{
    for(const [key,uniform]of Object.entries(material.userData.tearAppearance))shader.uniforms['tear_'+key]=uniform;
    shader.uniforms.tearHoles=material.userData.tears.holes;
    shader.uniforms.tearDetails=material.userData.tears.details;
    shader.uniforms.fabricReflection=material.userData.reflectionControls.reflection;
    shader.uniforms.fabricSparkle=material.userData.reflectionControls.sparkle;
    shader.uniforms.fiberDetail={value:maps.detail};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      attribute float fabricSide;
      attribute float fabricToe;
      varying float fabricSideId;
      varying float toeCoverage;
      attribute float fabricStretch;
      attribute float fabricCompression;
      varying vec2 fabricUv;
      varying float fabricTension;
      varying float fabricCrease;
    `).replace('#include <uv_vertex>',`#include <uv_vertex>
      fabricUv=uv;fabricSideId=fabricSide;toeCoverage=fabricToe;
      fabricTension=fabricStretch;
      fabricCrease=fabricCompression;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying float fabricSideId;
      uniform vec4 tearHoles[${TEARS_PER_LEG*2}];
      uniform vec4 tearDetails[${TEARS_PER_LEG*2}];
      ${TEAR_GLSL}
      ${Object.keys(material.userData.tearAppearance).map(key=>'uniform float tear_'+key+';').join('\n')}
      // Analytic line coverage with a pixel footprint; unresolved strands average out.
      float yarnLine(float phase,float thickness){
        float footprint=max(fwidth(phase),.0001);
        float distance=abs(fract(phase+.5)-.5);
        float line=1.0-smoothstep(thickness*.5-footprint,thickness*.5+footprint,distance);
        return mix(line,thickness,smoothstep(.25,.75,footprint));
      }
      varying float toeCoverage;
      uniform sampler2D fiberDetail;
      uniform float fabricReflection;
      uniform float fabricSparkle;
      varying vec2 fabricUv;
      varying float fabricTension;
      varying float fabricCrease;
    `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float rim=0.0,ladder=0.0,edgeYarn=0.0,runYarn=0.0;
      for(int i=0;i<${TEARS_PER_LEG*2};i++){
        vec4 hole=tearHoles[i],detail=tearDetails[i];
        if(hole.z<=0.0||abs(detail.w-fabricSideId)>.1)continue;
        vec2 delta=fabricUv-hole.xy;delta.x-=floor(delta.x+.5);
        vec2 q=delta/hole.zw;
        float sd=tearDistance(q,detail.x);
        // Keep the opening empty; a narrow outer band holds frayed thread ends.
        if(sd<0.0)discard;
        float rimScale=max(.001,tear_rimWidth*.55);
        float band=exp(-sd*sd/(rimScale*rimScale))*step(.001,tear_rimWidth);
        float yarn=.5+.5*sin(sd*62.0+sin(atan(q.y,q.x)*31.0+detail.x)*.8);
        rim=max(rim,band);edgeYarn=max(edgeYarn,band*yarn);
        float reach=delta.y>0.0?detail.y:detail.z;
        float along=abs(delta.y)/reach;
        float width=hole.z*mix(.92,.70,clamp(along,0.0,1.0))*(1.0+.08*sin(delta.y*120.0+detail.x));
        float run=(1.0-smoothstep(.75,1.0,along))*(1.0-smoothstep(width*.65,width,abs(delta.x+.0015*sin(delta.y*55.0+detail.x))));
        run*=1.0-smoothstep(-.1,.3,1.0-abs(q.y));
        // Strands spread around the opening, with bowed cross-links between columns.
        float bend=tear_yarnBend;
        float bendX=(q.x/sqrt(q.x*q.x+.16))*hole.z*.35*exp(-q.y*q.y*.65)*bend;
        float warpPhase=(delta.x-bendX+.0015*bend*sin(delta.y*90.0+detail.x))*mix(90.0,540.0,tear_warpDensity);
        float weftPhase=(delta.y+.002*bend*sin(q.x*5.0+detail.x))*mix(120.0,900.0,tear_weftDensity);
        float thickness=mix(.04,.48,tear_yarnThickness);
        float vertical=yarnLine(warpPhase,thickness)*tear_warpStrength;
        float horizontal=yarnLine(weftPhase,thickness*.72)*tear_weftStrength;
        float interlace=.86+.14*sin(warpPhase*3.14159)*sin(weftPhase*3.14159);
        float strands=(vertical+horizontal-vertical*horizontal)*interlace;
        runYarn=max(runYarn,run*strands);
        ladder=max(ladder,run);
      }
      // Raised, light-responsive bundles around each tear, not a painted halo.
      float edgeHeight=edgeYarn*.00065*tear_rimRelief+runYarn*.00015*tear_yarnGloss;
      vec3 dpdx=dFdx(-vViewPosition),dpdy=dFdy(-vViewPosition);
      vec3 r1=cross(dpdy,normal),r2=cross(normal,dpdx);
      float det=dot(dpdx,r1);
      if(abs(det)>1e-12)normal=normalize(abs(det)*normal-sign(det)*(dFdx(edgeHeight)*r1+dFdy(edgeHeight)*r2));
      // Optical coverage rises at grazing angles; stretched knit becomes more open.
      // Use the smooth geometric normal so individual yarn bumps do not flicker alpha.
      float fabricCos=abs(dot(normalize(vNormal),normalize(vViewPosition)));
      vec3 fiberData=texture2D(fiberDetail,fabricUv*vec2(10.0,32.0)).rgb;
      float opticalDepth=(opacity*.80+toeCoverage*.23)*(1.0+.25*fabricCrease)/(1.0+fabricTension*.85);
      float fabricCoverage=1.0-exp(-opticalDepth/max(.055,pow(fabricCos,1.35)));
      diffuseColor.a=clamp(fabricCoverage*(.87+.13*fiberData.r),.02,.97);
      // Dark fibers remain dark while skin shows through the open knit.
      diffuseColor.rgb*=.82+.18*fiberData.r;
      diffuseColor.a*=1.0-ladder*.86;
      diffuseColor.a+=fabricCoverage*runYarn*.86;
      diffuseColor.a=mix(diffuseColor.a,max(diffuseColor.a,.72),rim*tear_rimDarkness*(.4+.4*edgeYarn));
      diffuseColor.rgb*=1.0+edgeYarn*.22*tear_rimRelief;
    `).replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',`
      // Modulate actual light-dependent specular, never add unlit white noise.
      float fiberGlint=mix(1.0,mix(.25,4.0,smoothstep(.72,.98,fiberData.b)),fabricSparkle);
      vec3 outgoingLight=totalDiffuse+totalSpecular*fiberGlint*fabricReflection*(1.0+runYarn*tear_yarnGloss*2.5)+totalEmissiveRadiance;
    `).replace('sheenSpecularDirect + sheenSpecularIndirect;', '( sheenSpecularDirect + sheenSpecularIndirect ) * fabricReflection;');
  };
  material.customProgramCacheKey=()=> 'nylon-adjustable-yarns-v6';
  return material;
}

export function createStudioEnvironment(renderer) {
  const room=new THREE.Scene();room.background=new THREE.Color(0x17191d);
  const card=(x,y,z,w,h,intensity)=>{
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color().setScalar(intensity),side:THREE.DoubleSide}));
    panel.position.set(x,y,z);panel.lookAt(0,1.5,0);room.add(panel);
  };
  card(-3,2,1,1,5,4);card(3,2,-.5,.7,5,5);card(0,5,1,3,2,1.2);
  const pmrem=new THREE.PMREMGenerator(renderer),target=pmrem.fromScene(room,.035,.1,30);
  pmrem.dispose();room.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  return target;
}
