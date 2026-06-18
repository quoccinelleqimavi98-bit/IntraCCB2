import type { Environment } from './environment.types';

/**
 * Configuration d'environnement — PRODUCTION (valeur par défaut).
 * Surchargée par `environment.development.ts` lors d'un build de développement.
 *
 * ⚠️ Ne contient AUCUN secret : ce fichier est livré au navigateur.
 *    L'authentification réelle doit être assurée côté serveur (API).
 */
export const environment: Environment = {
  production: true,
  apiBaseUrl: 'https://www.cloechaudronbeauty.com/backend/api/',
};
