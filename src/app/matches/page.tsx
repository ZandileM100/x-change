"use client";
import { useEffect, useState } from "react"; import Link from "next/link"; import Shell, { useMe } from "@/components/Shell"; import Avatar from "@/components/Avatar"; import { supabase } from "@/lib/supabase";
type P = { display_name: string; avatar_url: string | null; bio: string | null };
type L = { title: string; est_hours: number; o: { name: string }; r: { name: string } };
type M = { id: string; status: string; score: number; same_campus: boolean; user_a: string; user_b: string; pa: P; pb: P; a_accepted_at: string | null; b_accepted_at: string | null; a_confirmed_at: string | null; b_confirmed_at: string | null; expires_at: string; la: L; lb: L; vault_tasks: { done: boolean }[] };
type LM = { position: number; user_id: string; accepted_at: string | null; confirmed_at: string | null; profiles: { display_name: string; avatar_url: string | null }; listings: { title: string; o: { name: string }; r: { name: string } } };
type Loop = { id: string; status: string; expires_at: string; loop_members: LM[] };
const lsel = "title,est_hours,o:skills!offered_skill_id(name),r:skills!requested_skill_id(name)";
const sel = `id,status,score,same_campus,user_a,user_b,pa:profiles!user_a(display_name,avatar_url,bio),pb:profiles!user_b(display_name,avatar_url,bio),a_accepted_at,b_accepted_at,a_confirmed_at,b_confirmed_at,expires_at,la:listings!listing_a(${lsel}),lb:listings!listing_b(${lsel}),vault_tasks(done)`;
const fit = (s: number) => s >= 80 ? "Excellent fit" : s >= 55 ? "Good fit" : s >= 30 ? "Fair fit" : "Low fit";
function balance(a: number, b: number) { const hi = Math.max(a, b), lo = Math.min(a, b); return hi / lo <= 1.25 ? { ok: true, t: `Balanced: about ${a} h for ${b} h` } : { ok: false, t: `Uneven: ${a} h for ${b} h. Agree how to even it out` }; }
function Inner() {
  const { me } = useMe(); const [ms, setMs] = useState<M[]>([]); const [loops, setLoops] = useState<Loop[]>([]); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false); const [campusOnly, setCampusOnly] = useState(false); const [party, setParty] = useState(false);
  const load = () => { supabase.from("matches").select(sel).or(`user_a.eq.${me?.id},user_b.eq.${me?.id}`).order("score", { ascending: false }).limit(50).then(r => setMs((r.data as unknown as M[]) ?? []));
    supabase.from("loops").select(`id,status,expires_at,loop_members(position,user_id,accepted_at,confirmed_at,profiles(display_name,avatar_url),listings(title,o:skills!offered_skill_id(name),r:skills!requested_skill_id(name)))`).order("created_at", { ascending: false }).limit(20).then(r => setLoops(((r.data as unknown as Loop[]) ?? []).filter(l => l.loop_members.some(m => m.user_id === me?.id)))); };
  useEffect(() => { if (me) load(); }, [me]);
  async function run(label: string, ps: PromiseLike<{ error: { message: string } | null; data?: unknown }>[]) { setBusy(true); const rs = await Promise.all(ps); const e = rs.find(r => r.error)?.error; setMsg(e ? e.message : label); if (!e && rs.some(r => r.data === "completed")) { setParty(true); setTimeout(() => setParty(false), 4000); } setBusy(false); load(); }
  const mine = (m: M, k: "accepted" | "confirmed") => (m.user_a === me?.id ? m[`a_${k}_at`] : m[`b_${k}_at`]);
  const shown = ms.filter(m => !campusOnly || m.same_campus);
  return <>{party && <div className="party" aria-hidden="true">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.15}s`, background: ["#0f8b8d", "#b7e34a", "#13315c", "#ffb703"][i % 4] }} />)}<b>🎉 Exchange completed!</b></div>}<h1>Matches</h1>
    <div className="row"><button disabled={busy} onClick={() => run("Matching run complete.", [supabase.rpc("generate_matches"), supabase.rpc("generate_loops")])}>Find matches and loops</button>
      <label style={{ margin: 0, display: "flex", gap: ".4rem", fontWeight: 500 }}><input type="checkbox" style={{ width: "auto" }} checked={campusOnly} onChange={e => setCampusOnly(e.target.checked)} />Same campus only</label></div>
    <p role="status" className={msg.includes("complete") || msg.includes("recorded") || msg.includes("Accepted") ? "ok" : "err"}>{msg}</p>

    {loops.length > 0 && <><h2>Three-way loops</h2><p className="muted">No direct pair? A gives to B, B gives to C, C gives to A. Everyone must agree.</p></>}
    {loops.map(lp => { const mem = [...lp.loop_members].sort((a, b) => a.position - b.position); const my = mem.find(x => x.user_id === me?.id);
      return <article className="card" key={lp.id}><div className="row"><b>Loop of 3</b><span className={`tag ${lp.status}`} style={{ marginLeft: "auto" }}>{lp.status}</span></div>
        <div className="row" style={{ margin: ".6rem 0" }}>{mem.map((x, i) => <div key={x.user_id} className="row" style={{ gap: ".4rem" }}><Avatar name={x.profiles?.display_name} url={x.profiles?.avatar_url} size={34} />
          <div><b>{x.user_id === me?.id ? "You" : x.profiles?.display_name}</b><div className="muted">gives {x.listings?.o?.name} →{i === 2 ? " back to start" : ""}</div></div></div>)}</div>
        <p className="muted">Each person receives what they asked for: {mem.map(x => `${x.profiles?.display_name === undefined ? "" : x.user_id === me?.id ? "you" : x.profiles.display_name} wants ${x.listings?.r?.name}`).join("; ")}. Accepted by {mem.filter(x => x.accepted_at).length}/3, confirmed by {mem.filter(x => x.confirmed_at).length}/3.</p>
        {lp.status === "suggested" && my && !my.accepted_at && <><button disabled={busy} onClick={() => run("Accepted. Waiting for the others.", [supabase.rpc("respond_to_loop", { l: lp.id, accept: true })])}>Accept</button><button className="sec" disabled={busy} onClick={() => run("Declined.", [supabase.rpc("respond_to_loop", { l: lp.id, accept: false })])}>Decline</button></>}
        {["accepted", "completed"].includes(lp.status) && <Link href={`/loop/${lp.id}`}><button>Open loop chat</button></Link>}
        {lp.status === "accepted" && my && !my.confirmed_at && <button disabled={busy} onClick={() => run("Confirmation recorded.", [supabase.rpc("confirm_loop", { l: lp.id })])}>Confirm my part is done</button>}</article>; })}

    <h2>Direct matches</h2>
    {shown.length === 0 && <p className="card">No matches yet. Create a listing, then run matching. A match needs someone who offers what you want and wants what you offer.</p>}
    {shown.map(m => { const meA = m.user_a === me?.id; const o = meA ? m.pb : m.pa; const oid = meA ? m.user_b : m.user_a; const my = meA ? m.la : m.lb, th = meA ? m.lb : m.la; const bal = balance(my.est_hours, th.est_hours); const done = m.vault_tasks?.filter(t => t.done).length ?? 0; const tot = m.vault_tasks?.length ?? 0;
      return <article className="card" key={m.id}>
        <div className="row"><Avatar name={o?.display_name} url={o?.avatar_url} size={44} /><div><Link href={`/u/${oid}`}><b>{o?.display_name ?? "Partner"}</b></Link><div className="muted">{o?.bio}</div></div>
          <span style={{ marginLeft: "auto", textAlign: "right" }}><span className={`tag ${m.status}`}>{m.status}</span><div className="muted" title="Format 30 + weekdays 30 + city 20 + campus 20">{m.score}/100 · {fit(m.score)}</div></span></div>
        <p><b>You give:</b> {my.o.name} · <b>You get:</b> {th.o.name}</p>
        <p className="muted">Why: “{my.title}” offers {my.o.name} and wants {my.r.name}; “{th.title}” offers {th.o.name} and wants {th.r.name}.</p>
        <p>{m.same_campus && <span className="tag" style={{ marginRight: ".4rem" }}>Same campus</span>}<span className={`tag ${bal.ok ? "completed" : "declined"}`}>{bal.t}</span></p>
        {tot > 0 && <><p className="muted">Checklist: {done} of {tot} done</p><progress value={done} max={tot} style={{ width: "100%" }} aria-label="Checklist progress" /></>}
        <p className="muted">Expires {new Date(m.expires_at).toLocaleDateString()} · You {mine(m, "accepted") ? "accepted" : "have not accepted"}{m.status !== "suggested" ? ` · you ${mine(m, "confirmed") ? "confirmed" : "have not confirmed"} completion` : ""}</p>
        {m.status === "suggested" && !mine(m, "accepted") && <><button disabled={busy} onClick={() => run("Accepted. Waiting for the other person.", [supabase.rpc("respond_to_match", { m: m.id, accept: true })])}>Accept</button><button className="sec" disabled={busy} onClick={() => run("Declined.", [supabase.rpc("respond_to_match", { m: m.id, accept: false })])}>Decline</button></>}
        {m.status === "accepted" && <><Link href={`/vault/${m.id}`}><button>Open vault</button></Link>{!mine(m, "confirmed") && <button disabled={busy} onClick={() => run("Confirmation recorded.", [supabase.rpc("confirm_exchange", { m: m.id })])}>Confirm exchange completed</button>}</>}
        {m.status === "completed" && <Link href={`/vault/${m.id}`}><button className="sec">View vault & rate</button></Link>}</article>; })}</>;
}
export default function Matches() { return <Shell><Inner /></Shell>; }
