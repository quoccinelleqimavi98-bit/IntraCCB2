/**
 * Type de configuration d'environnement.
 * Placé dans un fichier dédié (non concerné par le remplacement dev/prod) afin
 * que `environment.ts` et `environment.development.ts` puissent le partager.
 */
export interface Environment {
  readonly production: boolean;
  /** URL de base de l'API (terminée par « / »). */
  readonly apiBaseUrl: string;
}
