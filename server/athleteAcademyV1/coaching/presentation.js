// Owner-authenticated presentation only. Redaction is independent of feature
// activation so a read hold cannot expose private provider/reservation metadata.
export function redactCoachingPresentation(source) {
  const surface=structuredClone(source);
  surface.visuals=(surface.visuals||[]).map(sourceVisual=>{
    const visual=structuredClone(sourceVisual);
    delete visual.receipt;
    delete visual.plan?.providerReceipt;
    return visual;
  });
  if(surface.pendingAttempt?.flagship){
    const {contract,event}=surface.pendingAttempt.flagship;
    surface.pendingAttempt.flagship={contract,event};
  }
  return surface;
}
