// Réplique de pricing.lineTotal — AVANT (10 km offerts si pas fullKm) vs APRÈS.
const before = (p) => {
  if (p.qte === '?') return 0;
  const qte = Number(p.qte), prix = p.prix ?? 0;
  let total = prix * qte;
  if (p.kilorly) total = p.fullKm ? qte*2*prix : (qte <= 10 ? 0 : (qte-10)*2*prix);
  if (p.reduc) total -= total*p.reduc/100;
  if (Number.isInteger(prix) || p.kilorly) total = Math.floor(total);
  return total;
};
const after = (p) => {
  if (p.qte === '?') return 0;
  const qte = Number(p.qte), prix = p.prix ?? 0;
  let total = prix * qte;
  if (p.kilorly) total = qte*2*prix;            // tous les km facturés
  if (p.reduc) total -= total*p.reduc/100;
  if (Number.isInteger(prix) || p.kilorly) total = Math.floor(total);
  return total;
};
const cases = [
  { label: 'Essai 8 km (ancienne ligne, pas fullKm)', p: { kilorly:true, qte:8,  prix:0.4 } },
  { label: 'Jour-J 30 km (ancienne ligne)',           p: { kilorly:true, qte:30, prix:0.4 } },
  { label: 'Prestataire/renfort 45 km',               p: { kilorly:true, qte:45, prix:0.4 } },
  { label: 'Ligne fullKm 30 km (déjà pleine)',        p: { kilorly:true, fullKm:true, qte:30, prix:0.4 } },
  { label: 'Forfait normal (non km) ×2 à 250',        p: { qte:2, prix:250 } },
];
for (const c of cases) {
  console.log(`${c.label}\n   avant=${before(c.p)}€   après=${after(c.p)}€`);
}
