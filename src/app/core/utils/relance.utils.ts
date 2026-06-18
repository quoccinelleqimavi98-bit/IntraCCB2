/**
 * Construction du message de relance envoyé aux mariées (demandes sans réponse).
 * Fonctions pures : la composition du `mailto:` et les effets de bord (ouverture
 * du client mail, presse-papiers) restent dans le composant.
 */

export function relanceSubject(dateLabel: string): string {
  return `Disponibilité pour votre mariage du ${dateLabel}`;
}

export function relanceBody(nom: string | undefined, dateLabel: string): string {
  return (
    `Bonjour ${nom ?? ''},\n\n` +
    "J'espère que vous allez bien.\n\n" +
    'Je me permets de revenir vers vous concernant votre mariage du ' +
    `${dateLabel} prochain.\n` +
    "N'ayant pas encore reçu de confirmation de votre part, je souhaitais savoir si vous " +
    'souhaitiez toujours faire appel à mes services.\n\n' +
    "À noter que j'ai récemment reçu une autre demande pour cette même date.\n" +
    'Afin de pouvoir organiser mon planning au mieux, pourriez-vous me tenir informée de ' +
    'votre décision ?\n\n' +
    "N'hésitez pas à me contacter si vous avez la moindre question.\n\n" +
    "Au plaisir d'échanger avec vous,\n" +
    'Belle journée à vous. 🌞\n'
  );
}

/** URL de la demande sur mariages.net (relance sans adresse mail). */
export function mariagesNetUrl(id: string): string {
  return `https://www.mariages.net/emp-AdminSolicitudesShow.php?id_solicitud=${id}`;
}
