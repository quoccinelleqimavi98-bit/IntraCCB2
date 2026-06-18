import type { Environment } from './environment.types';

/**
 * Configuration d'environnement — DÉVELOPPEMENT.
 * On vise la même API qu'en production par défaut ; ajustez `apiBaseUrl`
 * pour pointer vers un backend local si besoin.
 */
export const environment: Environment = {
  production: false,
  apiBaseUrl: 'https://www.cloechaudronbeauty.com/backend/api/',
};
