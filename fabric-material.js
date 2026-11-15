import * as THREE from 'three';

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
  material.onBeforeCompile=shader=>{
    shader.uniforms.fabricReflection=material.userData.reflectionControls.reflection;
    shader.uniforms.fabricSparkle=material.userData.reflectionControls.sparkle;
    shader.uniforms.fiberDetail={value:maps.detail};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      attribute vec2 fabricDamage;
      attribute float fabricToe;
      varying vec2 fabricTear;
      varying float toeCoverage;
      attribute float fabricStretch;
      attribute float fabricCompression;
      varying vec2 fabricUv;
      varying float fabricTension;
      varying float fabricCrease;
    `).replace('#include <uv_vertex>',`#include <uv_vertex>
      fabricUv=uv;fabricTear=fabricDamage;toeCoverage=fabricToe;
      fabricTension=fabricStretch;
      fabricCrease=fabricCompression;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec2 fabricTear;
      varying float toeCoverage;
      uniform sampler2D fiberDetail;
      uniform float fabricReflection;
      uniform float fabricSparkle;
      varying vec2 fabricUv;
      varying float fabricTension;
      varying float fabricCrease;
    `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      // Ragged cut edge and a few surviving cross threads, all in fabric coordinates.
      float tearEdge=length(fabricTear);
      float ragged=.045*sin(fabricUv.x*1900.0)+.035*sin(fabricUv.y*2700.0);
      float fringe=smoothstep(.82,1.14,tearEdge+ragged);
      if(tearEdge+ragged<1.0){
        float thread=step(.94,fract(fabricUv.y*1400.0));
        if(tearEdge<.84||thread<.5)discard;
      }
      float ladder=(1.0-smoothstep(.15,.48,abs(fabricTear.x)))*smoothstep(.8,1.2,fabricTear.y)*(1.0-smoothstep(2.0,3.8,fabricTear.y));
      // Optical coverage rises at grazing angles; stretched knit becomes more open.
      // Use the smooth geometric normal so individual yarn bumps do not flicker alpha.
      float fabricCos=abs(dot(normalize(vNormal),normalize(vViewPosition)));
      vec3 fiberData=texture2D(fiberDetail,fabricUv*vec2(10.0,32.0)).rgb;
      float opticalDepth=(opacity*.80+toeCoverage*.23)*(1.0+.25*fabricCrease)/(1.0+fabricTension*.85);
      float fabricCoverage=1.0-exp(-opticalDepth/max(.055,pow(fabricCos,1.35)));
      diffuseColor.a=clamp(fabricCoverage*(.87+.13*fiberData.r),.02,.97);
      // Dark fibers remain dark while skin shows through the open knit.
      diffuseColor.rgb*=.82+.18*fiberData.r;
      diffuseColor.a*=mix(1.0,.22,ladder*(.5+.5*sin(fabricUv.x*3100.0)));
      diffuseColor.a*=mix(.65,1.0,fringe);
    `).replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',`
      // Modulate actual light-dependent specular, never add unlit white noise.
      float fiberGlint=mix(1.0,mix(.25,4.0,smoothstep(.72,.98,fiberData.b)),fabricSparkle);
      vec3 outgoingLight=totalDiffuse+totalSpecular*fiberGlint*fabricReflection+totalEmissiveRadiance;
    `).replace('sheenSpecularDirect + sheenSpecularIndirect;', '( sheenSpecularDirect + sheenSpecularIndirect ) * fabricReflection;');
  };
  material.customProgramCacheKey=()=> 'nylon-tear-toe-v4';
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
