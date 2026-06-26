import { compareTwoStrings as cs } from 'string-similarity';

export function compareStrings(a: string, b: string): number {
  if (!a || !b) return 0;
  return cs(a.toLowerCase(), b.toLowerCase());
}
