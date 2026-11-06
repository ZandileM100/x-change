import { describe, it, expect } from "vitest";
import { findReciprocalMatches as f, Listing } from "./matching";
const L = (id: string, ow: string, off: string, req: string, active = true): Listing =>
  ({ id, ownerId: ow, offered: off, requested: req, active });
describe("reciprocal matching", () => {
  it("matches a true reciprocal pair", () =>
    expect(f([L("1","A","Web Dev","Graphic Design"), L("2","B","graphic  design","web dev")])).toHaveLength(1));
  it("rejects one-way only", () =>
    expect(f([L("1","A","Web Dev","Graphic Design"), L("2","B","Graphic Design","Tutoring")])).toHaveLength(0));
  it("rejects same user", () =>
    expect(f([L("1","A","Web Dev","Graphic Design"), L("2","A","Graphic Design","Web Dev")])).toHaveLength(0));
  it("ignores inactive listings", () =>
    expect(f([L("1","A","Web Dev","Graphic Design"), L("2","B","Graphic Design","Web Dev", false)])).toHaveLength(0));
  it("does not duplicate existing matches", () =>
    expect(f([L("1","A","Web Dev","Graphic Design"), L("2","B","Graphic Design","Web Dev")],
      { existing: new Set(["1:2"]) })).toHaveLength(0));
  it("honours aliases and blocks", () => {
    const ls = [L("1","A","Web Dev","Design"), L("2","B","Graphic Design","Web Dev")];
    expect(f(ls, { aliases: { design: "graphic design" } })).toHaveLength(1);
    expect(f(ls, { aliases: { design: "graphic design" }, blocked: new Set(["A:B"]) })).toHaveLength(0);
  });
});
import { findThreeWayLoops as loops } from "./matching";
describe("three-way loops", () => {
  const A = L("1", "A", "Bookkeeping", "Marketing"), B = L("2", "B", "Marketing", "Writing"), C = L("3", "C", "Writing", "Bookkeeping");
  it("finds a triangle once", () => expect(loops([A, B, C])).toHaveLength(1));
  it("finds it regardless of list order", () => expect(loops([C, A, B])).toHaveLength(1));
  it("needs three different people", () => expect(loops([A, B, L("3", "A", "Writing", "Bookkeeping")])).toHaveLength(0));
  it("ignores inactive listings", () => expect(loops([A, B, L("3", "C", "Writing", "Bookkeeping", false)])).toHaveLength(0));
  it("rejects a broken chain", () => expect(loops([A, B, L("3", "C", "Writing", "Tutoring")])).toHaveLength(0));
});
