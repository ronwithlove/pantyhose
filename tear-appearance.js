// Slider units are art-direction values (0–100), not measured yarn properties.
export const tearAppearanceDefaults=Object.freeze({
  rimDarkness:47,rimWidth:100,rimRelief:100,
  warpStrength:100,weftStrength:100,warpDensity:2,weftDensity:62,
  yarnThickness:49,yarnBend:100,yarnGloss:41,
});
export function createTearAppearance(){
  return Object.fromEntries(Object.entries(tearAppearanceDefaults).map(([key,value])=>[key,{value:value/100}]));
}
export function setTearAppearance(uniforms,key,value){
  if(!Object.hasOwn(tearAppearanceDefaults,key)||!Number.isFinite(Number(value)))return false;
  uniforms[key].value=Math.round(Math.max(0,Math.min(100,Number(value))))/100;return true;
}
export function serializeTearAppearance(uniforms){
  return JSON.stringify(Object.fromEntries(Object.keys(tearAppearanceDefaults).map(key=>[key,Math.round(uniforms[key].value*100)])),null,2);
}
export function bindTearAppearance(document,uniforms,setLocalizedText){
  const container=document.getElementById('tearAppearanceControls'),fields=new Map();
  const values=document.getElementById('tearAppearanceValues');
  const sync=()=>{for(const [key,{input,output}]of fields){input.value=String(Math.round(uniforms[key].value*100));output.value=input.value+'%';}values.value=serializeTearAppearance(uniforms);};
  for(const key of Object.keys(tearAppearanceDefaults)){
    const label=document.createElement('label'),output=document.createElement('output'),input=document.createElement('input');
    input.id='tear-'+key;input.type='range';input.min='0';input.max='100';input.step='1';
    label.htmlFor=input.id;label.append(output);setLocalizedText(label,key);
    input.oninput=()=>{setTearAppearance(uniforms,key,input.value);sync();};
    container.append(label,input);fields.set(key,{input,output});
  }
  document.getElementById('resetTearAppearance').onclick=()=>{for(const [key,value]of Object.entries(tearAppearanceDefaults))setTearAppearance(uniforms,key,value);sync();};
  sync();
}
