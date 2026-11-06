export type Listing = { id: string; ownerId: string; offered: string; requested: string; active: boolean };
export type Pair = { a: Listing; b: Listing };

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Mirrors the SQL generate_matches() rules, so the logic is testable without a database. */
export function findReciprocalMatches(
  listings: Listing[],
  opts: { aliases?: Record<string, string>; blocked?: Set<string>; existing?: Set<string> } = {},
): Pair[] {
  const canon = (s: string) => { const n = norm(s); return opts.aliases?.[n] ?? n; };
  const out: Pair[] = [];
  for (let i = 0; i < listings.length; i++)
    for (let j = i + 1; j < listings.length; j++) {
      const [a, b] = [listings[i], listings[j]];
      if (!a.active || !b.active || a.ownerId === b.ownerId) continue;
      if (opts.blocked?.has(`${a.ownerId}:${b.ownerId}`) || opts.blocked?.has(`${b.ownerId}:${a.ownerId}`)) continue;
      const key = [a.id, b.id].sort().join(":");
      if (opts.existing?.has(key)) continue;
      if (canon(a.offered) === canon(b.requested) && canon(b.offered) === canon(a.requested)) out.push({ a, b });
    }
  return out;
}

/** Three-way loops: A gives to B, B gives to C, C gives to A. Mirrors SQL generate_loops(). */
export function findThreeWayLoops(listings: Listing[], aliases: Record<string, string> = {}): Listing[][] {
  const canon = (s: string) => { const n = norm(s); return aliases[n] ?? n; };
  const act = listings.filter(l => l.active); const out: Listing[][] = [];
  for (const a of act) for (const b of act) {
    if (a.ownerId === b.ownerId || a.id >= b.id || canon(b.requested) !== canon(a.offered)) continue;
    for (const c of act) {
      if (c.ownerId === a.ownerId || c.ownerId === b.ownerId || a.id >= c.id) continue;
      if (canon(c.requested) === canon(b.offered) && canon(c.offered) === canon(a.requested)) out.push([a, b, c]);
    }
  }
  return out;
}
