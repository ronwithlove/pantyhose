// Static, collision-constrained membrane relaxation. Rest edge lengths belong
// to the garment; body sections are only a collision boundary. The seed merely
// breaks perfect symmetry: the final drape is determined by the constraints.
export function solveStockingDrape(shell,N,M,restRatio,longitudinalSlack){
  const stride=N+1,count=(M+1)*N,source=shell.fitRest,ys=shell.fittedRows;
  const p=new Float64Array(count*3),mobility=new Float64Array(count),attachment=new Float64Array(count),edges=[];
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const blend=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
  for(let j=0;j<=M;j++)for(let i=0;i<N;i++){
    const v=j*N+i,k=v*3,s=(j*stride+i)*3,a=i/N*Math.PI*2;
    const attached=blend((ys[j]-shell.ankleHeight-.055)/.075)*blend((shell.height-ys[j])/.055);
    attachment[v]=attached;const free=attached*blend(Math.max(0,restRatio[j]-1)/.12);
    mobility[v]=free;
    const seed=Math.min(.03,shell.radii[j*stride+i]*Math.max(0,restRatio[j]-1)*.65)*free+.0006*free*(.5+.5*Math.sin(ys[j]*380+3*Math.sin(a)+1.5*Math.cos(a*3)+shell.fabric.side*.8));
    p[k]=source[s]+Math.cos(a)*seed;p[k+1]=source[s+1];p[k+2]=source[s+2]+Math.sin(a)*seed;
  }
  const liftLimit=j=>Math.min(.025,.006+.024*Math.max(0,restRatio[j]-1))*(ys[j]<shell.ankleHeight+.4?.6:1);
  const edge=(a,b,ratio,stiffness)=>{
    const sa=(Math.floor(a/N)*stride+a%N)*3,sb=(Math.floor(b/N)*stride+b%N)*3;
    const length=Math.hypot(source[sb]-source[sa],source[sb+1]-source[sa+1],source[sb+2]-source[sa+2]);
    edges.push(a,b,length*ratio,stiffness);
  };
  for(let j=0;j<=M;j++)for(let i=0;i<N;i++){
    const a=j*N+i,b=j*N+(i+1)%N;
    edge(a,b,restRatio[j],.45);
    if(j<M){
      edge(a,a+N,1+longitudinalSlack[j],.82);
      if(j<M-1)edge(a,a+2*N,1,.085);
      // Diagonal shear constraints are soft enough to permit fine buckling.
      edge(a,(j+1)*N+(i+1)%N,Math.sqrt((restRatio[j]**2+(1+longitudinalSlack[j])**2)/2),.075);
    }
  }
  const radialBoundary=(y,a)=>{
    let lo=0,hi=M;while(hi-lo>1){const mid=(lo+hi)>>1;if(ys[mid]<=y)lo=mid;else hi=mid;}
    const t=clamp((y-ys[lo])/(ys[hi]-ys[lo]),0,1),u=((a/(2*Math.PI)+1)%1)*N,i=Math.floor(u),f=u-i;
    const cx=shell.centers[lo].x*(1-t)+shell.centers[hi].x*t,cz=shell.centers[lo].z*(1-t)+shell.centers[hi].z*t;
    const r0=shell.radii[lo*stride+i]*(1-f)+shell.radii[lo*stride+i+1]*f;
    const r1=shell.radii[hi*stride+i]*(1-f)+shell.radii[hi*stride+i+1]*f;
    return [cx,cz,r0*(1-t)+r1*t];
  };
  for(let iteration=0;iteration<100;iteration++){
    for(let v=0;v<count;v++)p[v*3+1]-=.000018*mobility[v];
    // Reverse traversal alternates the bias of sequential position projection.
    for(let e=iteration%2?edges.length-4:0;e>=0&&e<edges.length;e+=iteration%2?-4:4){
      const a=edges[e],b=edges[e+1],wa=mobility[a],wb=mobility[b],w=wa+wb;if(!w)continue;
      const ka=a*3,kb=b*3,dx=p[kb]-p[ka],dy=p[kb+1]-p[ka+1],dz=p[kb+2]-p[ka+2],length=Math.hypot(dx,dy,dz);
      if(length<1e-10)continue;
      const c=(length-edges[e+2])/length*edges[e+3]/w;
      p[ka]+=dx*c*wa;p[ka+1]+=dy*c*wa;p[ka+2]+=dz*c*wa;
      p[kb]-=dx*c*wb;p[kb+1]-=dy*c*wb;p[kb+2]-=dz*c*wb;
    }
    for(let j=0;j<=M;j++)for(let i=0;i<N;i++){
      const v=j*N+i,k=v*3,s=(j*stride+i)*3,w=mobility[v];if(!w)continue;
      p[k+1]=clamp(p[k+1],ys[j]-.045,ys[j]+.025);
      // Keep material rows ordered; this rest solver does not model self-contact.
      if(j>0)p[k+1]=Math.max(p[k+1],p[(v-N)*3+1]+(ys[j]-ys[j-1])*.25);
      const angle=Math.atan2(source[s+2]-shell.centers[j].z,source[s]-shell.centers[j].x);
      const [cx,cz,rmin]=radialBoundary(p[k+1],angle),dx=p[k]-cx,dz=p[k+2]-cz,r=Math.hypot(dx,dz);
      const rmax=rmin+liftLimit(j)*w;
      const target=clamp(r,rmin,rmax);
      p[k]=cx+Math.cos(angle)*target;p[k+2]=cz+Math.sin(angle)*target;
      // Gradual attachment at the cuff/foot, not a cut seam.
      const attached=attachment[v];
      if(attached<1){p[k]=source[s]+(p[k]-source[s])*attached;p[k+1]=source[s+1]+(p[k+1]-source[s+1])*attached;p[k+2]=source[s+2]+(p[k+2]-source[s+2])*attached;}
    }
    // Hoop bending resistance prevents triangle-scale concertina artifacts.
    // Smooth radial lift, rather than world positions, to retain body anatomy.
    const smooth=p.slice();
    for(let j=1;j<M;j++)for(let i=0;i<N;i++){
      const v=j*N+i,k=v*3,w=mobility[v];if(!w)continue;
      const left=(j*N+(i+N-1)%N)*3,right=(j*N+(i+1)%N)*3;
      const src=(j*stride+i)*3,cx=shell.centers[j].x,cz=shell.centers[j].z,a=Math.atan2(source[src+2]-cz,source[src]-cx);
      const lift=kk=>Math.hypot(smooth[kk]-cx,smooth[kk+2]-cz)-shell.radii[j*stride+(kk/3)%N];
      const radial=(lift(left)+lift(right))*.5*.7+lift(k)*.3;
      const y=(smooth[left+1]+smooth[right+1])*.35+smooth[k+1]*.3;
      const [bx,bz,br]=radialBoundary(y,a);
      p[k]=bx+Math.cos(a)*(br+clamp(radial,0,liftLimit(j)*w));p[k+1]=y;p[k+2]=bz+Math.sin(a)*(br+clamp(radial,0,liftLimit(j)*w));
    }
  }
  const offsets=new Float32Array((M+1)*stride*3),gap=new Float32Array((M+1)*stride);
  for(let j=0;j<=M;j++)for(let i=0;i<=N;i++){
    const src=(j*N+i%N)*3,dst=(j*stride+i)*3;
    // Blend the solved displacement into the attached foot over several rows.
    // Otherwise the lower free row forms a false hem above the heel.
    const fade=blend((ys[j]-shell.ankleHeight-.06)/.18);
    for(let c=0;c<3;c++)offsets[dst+c]=(p[src+c]-source[dst+c])*fade;
    gap[j*stride+i]=Math.hypot(offsets[dst],offsets[dst+2]);
  }
  return {offsets,gap};
}
