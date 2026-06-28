// Réplique de duplicatePresta : avenant => confie 1 au prestataire, sinon copie.
function duplicate(prestas, presta, isAvenant) {
  const index = prestas.indexOf(presta);
  if (isAvenant) {
    const base = Number(presta.qte);
    if (presta.qte !== '?' && base >= 2) presta.qte = base - 1;
    const copy = { ...presta, renfortQte: undefined, renfort: true, qte: 1 };
    prestas.splice(index + 1, 0, copy);
  } else {
    prestas.splice(index + 1, 0, { ...presta, renfortQte: undefined });
  }
}
let pass=0, fail=0; const ck=(l,c)=>{console.log(`  ${c?'✓':'✗'} ${l}`); c?pass++:fail++;};

console.log('1) Avenant, base ≥ 2 : base −1, nouvelle ligne = 1 au prestataire');
{ const ps=[{nom:'Forfait', qte:6}]; duplicate(ps, ps[0], true);
  ck('base passe à 5', ps[0].qte===5);
  ck('nouvelle ligne qte 1', ps[1].qte===1);
  ck('nouvelle ligne = prestataire', ps[1].renfort===true);
  ck('total conservé (5+1=6)', Number(ps[0].qte)+Number(ps[1].qte)===6); }

console.log('2) Deux duplications successives (6 → 4 moi + 2 presta)');
{ const ps=[{nom:'Forfait', qte:6}]; duplicate(ps, ps[0], true); duplicate(ps, ps[0], true);
  const mine = ps.filter(p=>!p.renfort).reduce((s,p)=>s+Number(p.qte),0);
  const presta = ps.filter(p=>p.renfort).reduce((s,p)=>s+Number(p.qte),0);
  ck('4 à moi', mine===4); ck('2 au prestataire', presta===2); }

console.log('3) Avenant, base = 1 : pas de décrément, nouvelle ligne prestataire à 1');
{ const ps=[{nom:'Forfait', qte:1}]; duplicate(ps, ps[0], true);
  ck('base reste 1', ps[0].qte===1);
  ck('nouvelle ligne 1 prestataire', ps[1].qte===1 && ps[1].renfort===true); }

console.log('4) Facture (hors avenant) : simple copie, pas de prestataire');
{ const ps=[{nom:'Forfait', qte:3}]; duplicate(ps, ps[0], false);
  ck('base inchangée', ps[0].qte===3);
  ck('copie identique, pas renfort', ps[1].qte===3 && !ps[1].renfort); }

console.log(`\n=== ${pass} réussis, ${fail} échoués ===`);
process.exit(fail?1:0);
