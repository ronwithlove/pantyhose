import { fittedRestState } from './stocking-fit.js?v=20261115-contact1';
self.onmessage=({data:{inputs,N,M,value}})=>{
  try {
    const states=inputs.map(shell=>fittedRestState(shell,N,M,value));
    self.postMessage({states},states.flatMap(s=>[s.offsets.buffer,s.gap.buffer,s.tension.buffer,s.compression.buffer,s.slack.buffer]));
  }catch(error){self.postMessage({error:error.message});}
};
