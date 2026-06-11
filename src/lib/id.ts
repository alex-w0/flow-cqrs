/** Collision-safe ids that stay readable in exported JSON. */
export function nextId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}
