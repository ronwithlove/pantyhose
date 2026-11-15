import { solveStockingDrape } from './stocking-drape.js?v=20261115-contact1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
function sample(ys,values,y){
  let j=0;while(j<ys.length-2&&ys[j+1]<y)j++;
  return mix(values[j],values[j+1],clamp((y-ys[j])/(ys[j+1]-ys[j]),0,1));
}
export function fittedRestState(shell,N,M,tightness=55){
  const stride=N+1,ys=shell.fittedRows,circumference=[];
  for(let j=0;j<=M;j++){
    let length=0;
    for(let i=0;i<N;i++){const a=(j*stride+i)*3,b=a+3,p=shell.fitRest;length+=Math.hypot(p[b]-p[a],p[b+2]-p[a+2]);}
    circumference.push(length);
  }
  const knee=shell.kneeHeight,top=shell.height;
  let ankleRow=ys.findIndex(y=>y>=shell.ankleHeight+.06);
  for(let j=ankleRow;j<=M&&ys[j]<Math.min(knee-.3,shell.ankleHeight+.35);j++)if(circumference[j]<circumference[ankleRow])ankleRow=j;
  const ankle=ys[ankleRow],cutY=[ankle+.025,knee-.24,knee,top];
  const cutC=[sample(ys,circumference,ankle+.25),sample(ys,circumference,knee-.24)*.94,
    mix(sample(ys,circumference,knee-.24),sample(ys,circumference,knee+.24),.5)*.99,sample(ys,circumference,top-.025)*.83];
  const size=1.36-.52*clamp(tightness,0,100)/100;
  const tension=new Float32Array(stride*(M+1)),compression=new Float32Array(tension.length),slack=new Float32Array(M+1),restRatio=[],longitudinalSlack=[];
  for(let j=0;j<=M;j++){
    const y=ys[j],restC=sample(cutY,cutC,y)*size,ratio=restC/circumference[j];
    const footFade=clamp((y-shell.ankleHeight-.055)/.075,0,1),cuffFade=clamp((top-y)/.055,0,1);
    const excess=Math.max(0,ratio-1)*footFade*cuffFade;
    slack[j]=excess;restRatio[j]=mix(1,clamp(ratio,.70,1.4),footFade*cuffFade);
    const joint=Math.exp(-Math.pow((y-ankle-.025)/.12,2))+.7*Math.exp(-Math.pow((y-knee)/.15,2));
    longitudinalSlack[j]=Math.min(.22,excess*.28)*joint;
    for(let i=0;i<=N;i++)tension[j*stride+i]=Math.max(0,1/ratio-1)*footFade;
  }
  const drape=solveStockingDrape(shell,N,M,restRatio,longitudinalSlack);
  conformJointAllowance(shell,N,M,drape,ankle);
  for(let j=1;j<M;j++)for(let i=0;i<=N;i++){
    const v=j*stride+i;
    const curvature=Math.abs(drape.gap[v-stride]+drape.gap[v+stride]-2*drape.gap[v]);
    compression[v]=Math.min(.4,curvature*22+longitudinalSlack[j]*.8);
  }
  return {...drape,tension,compression,slack,circumference,ankleHeight:ankle,restRatio,longitudinalSlack};
}

// A thin stocking stays in contact at narrow joints: solver allowance must not
// become a loose cylindrical sleeve. Keep the accepted thigh drape untouched.
export function conformJointAllowance(shell,N,M,drape,ankle){
  const stride=N+1,input=drape.offsets.slice(),ys=shell.fittedRows;
  const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
  const window=(y,center,inner,outer)=>1-smooth((Math.abs(y-center)-inner)/(outer-inner));
  for(let j=0;j<=M;j++){
    const weight=Math.max(window(ys[j],shell.kneeHeight,.13,.27),window(ys[j],ankle+.025,.12,.24));
    if(!weight)continue;
    for(let i=0;i<=N;i++){
      const v=j*stride+i,k=v*3;
      // Filter grid-scale kinks before applying a smooth (non-clipping) bound.
      let x=0,y=0,z=0;
      for(let dj=-1;dj<=1;dj++){
        const row=clamp(j+dj,0,M),q=(row*stride+i)*3,w=dj===0?.5:.25;
        x+=input[q]*w;y+=input[q+1]*w;z+=input[q+2]*w;
      }
      // Vertical sliding was carrying a different body contour over this row.
      // Retain only a small tangential shift so folds remain attached locally.
      y*=.12;
      const length=Math.hypot(x,y,z),limit=.0022;
      const scale=length>1e-10?limit*Math.tanh(length/limit)/length:1;
      for(const [c,value] of [[0,x],[1,y],[2,z]])drape.offsets[k+c]=mix(input[k+c],value*scale,weight);
      drape.gap[v]=Math.hypot(drape.offsets[k],drape.offsets[k+2]);
    }
  }
}
