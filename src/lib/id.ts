/**
 * Convert a counter (0-based) to an alphabetic ID: 0→A, 1→B, ..., 25→Z, 26→AA, 27→AB, ...
 */
export function counterToId(counter: number): string {
  let result = "";
  let n = counter;
  do {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return result;
}

/**
 * Convert an alphabetic ID back to a counter: A→0, B→1, ..., Z→25, AA→26, AB→27, ...
 */
export function idToCounter(id: string): number {
  let result = 0;
  for (let i = 0; i < id.length; i++) {
    result = result * 26 + (id.charCodeAt(i) - 64);
  }
  return result - 1;
}
