/** Copie profonde d'une valeur sérialisable. */
export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

/** Égalité profonde (suffisante pour des objets de données simples). */
export function deepEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
