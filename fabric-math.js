// Positive radial ridges avoid carving the cloth through the underlying skin.
// These are authored rest folds, not a full buckling simulation.
export function ankleFold(y,a) {
  const centers=[.335,.371,.412,.455,.501,.550,.604,.666,.735];
  let fold=0;
  for(let i=0;i<centers.length;i++){
    const center=centers[i]+.009*Math.sin(a*2+i*.75)+.005*Math.cos(a*3-i*.6);
    const width=.0065+i*.00055;
    const front=.4+.6*Math.pow(.5+.5*Math.sin(a),1.3);
    const amplitude=(.0052-i*.00038)*front;
    fold+=amplitude*Math.exp(-Math.pow((y-center)/width,2));
  }
  return fold;
}
export function angularCoverage(density,cosine,tension=0,compression=0) {
  return 1-Math.exp(-(density*.8*(1+.25*compression)/(1+tension*.85))/Math.max(.055,Math.pow(Math.abs(cosine),1.35)));
}

// 100% preserves the previous wide footprint; 40% is the new localized default.
// These are influence radii on the rest surface, independent of spring stiffness.
export function pullRadii(percent) {
  const scale=Math.max(.2,Math.min(1,percent/100));
  return {vertical:.72*scale,around:.48*scale};
}
export function pullDistance(verticalOffset,arcOffset,radii) {
  return Math.hypot(verticalOffset/radii.vertical,arcOffset/radii.around);
}
export function pullInfluence(distance) {
  return Math.pow(Math.max(0,1-distance),1.6);
}

// Independent art controls: travel/compliance and damping, not measured textile units.
export function stretchResponse(percent=50) {
  const t=Math.max(0,Math.min(100,percent))/100;
  return {gain:.35+1.3*t,maxDistance:.3+2*t};
}
export function reboundDamping(percent=50) {
  const t=Math.max(0,Math.min(100,percent))/100;
  return t<=.5?.35+(.67-.35)*t*2:.67+(1.05-.67)*(t-.5)*2;
}
