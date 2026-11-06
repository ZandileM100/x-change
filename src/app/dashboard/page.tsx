"use client";
import { useEffect, useState } from "react"; import Link from "next/link"; import Shell, { useMe } from "@/components/Shell"; import Avatar from "@/components/Avatar"; import { supabase } from "@/lib/supabase";
const RATE = 150; // illustrative rand-per-hour used only for the "value exchanged" estimate
type P = { display_name: string; bio: string | null; institution: string | null; city: string | null; avatar_url: string | null };
type M = { id: string; status: string; score: number; user_a: string; a_accepted_at: string | null; b_accepted_at: string | null; pa: { display_name: string; avatar_url: string | null }; pb: { display_name: string; avatar_url: string | null }; la: { est_hours: number; o: { name: string } }; lb: { est_hours: number; o: { name: string } } };
const NT: Record<string, string> = { match_suggested: "New match suggested", loop_suggested: "New three-way loop suggested", awarded: "Reputation points awarded", reminder_day7: "Reminder: day 7 of 14", reminder_day13: "Final reminder: expires tomorrow" };
function Inner() {
  const { me } = useMe(); const [p, setP] = useState<P | null>(null); const [ls, setLs] = useState(0); const [ms, setMs] = useState<M[]>([]); const [loopsOpen, setLoopsOpen] = useState(0); const [loading, setLoading] = useState(true);
  const [rep, setRep] = useState<{ reputation_points: number; completed_exchanges: number; has_starter_badge: boolean } | null>(null); const [nt, setNt] = useState<{ id: string; kind: string; created_at: string; read_at: string | null }[]>([]);
  useEffect(() => { if (!me) return; const id = me.id;
    Promise.all([
      supabase.from("profiles").select("display_name,bio,institution,city,avatar_url").eq("id", id).single().then(r => setP(r.data)),
      supabase.from("listings").select("id", { count: "exact", head: true }).eq("owner_id", id).eq("status", "active").then(r => setLs(r.count ?? 0)),
      supabase.from("matches").select("id,status,score,user_a,a_accepted_at,b_accepted_at,pa:profiles!user_a(display_name,avatar_url),pb:profiles!user_b(display_name,avatar_url),la:listings!listing_a(est_hours,o:skills!offered_skill_id(name)),lb:listings!listing_b(est_hours,o:skills!offered_skill_id(name))").or(`user_a.eq.${id},user_b.eq.${id}`).order("score", { ascending: false }).limit(100).then(r => setMs((r.data as unknown as M[]) ?? [])),
      supabase.from("loop_members").select("loop_id,loops(status)").eq("user_id", id).then(r => setLoopsOpen((r.data ?? []).filter((x: { loops: unknown }) => ["suggested", "accepted"].includes((x.loops as { status: string })?.status)).length)),
      supabase.from("user_reputation").select("reputation_points,completed_exchanges,has_starter_badge").eq("user_id", id).maybeSingle().then(r => setRep(r.data)),
      supabase.from("notifications").select("id,kind,created_at,read_at").order("created_at", { ascending: false }).limit(4).then(r => setNt(r.data ?? [])),
    ]).finally(() => setLoading(false)); }, [me]);
  if (loading || !p) return <p className="muted">Loading your dashboard…</p>;
  const mineA = (m: M) => m.user_a === me?.id; const myAcc = (m: M) => (mineA(m) ? m.a_accepted_at : m.b_accepted_at);
  const pending = ms.filter(m => m.status === "suggested" && !myAcc(m)); const active = ms.filter(m => m.status === "accepted"); const done = ms.filter(m => m.status === "completed");
  const responded = ms.filter(m => myAcc(m) || m.status === "declined").length; const rate = responded + pending.length ? Math.round((responded / (responded + pending.length)) * 100) : null;
  const hours = done.reduce((s, m) => s + (mineA(m) ? m.lb.est_hours : m.la.est_hours), 0);
  const complete = Math.min(100, [p.display_name, p.bio, p.institution, p.city].filter(v => v?.trim()).length * 20 + (p.avatar_url ? 20 : 0));
  const steps: [string, boolean, string][] = [["Complete your profile", complete >= 80, "/profile"], ["Post your first listing", ls > 0, "/listings"], ["Find your first match", ms.length > 0, "/matches"], ["Complete an exchange", (rep?.completed_exchanges ?? 0) > 0, "/matches"]];
  const stat = (n: number | string, l: string, href: string) => <Link href={href} className="card stat"><b>{n}</b><span className="muted">{l}</span></Link>;
  return <><div className="row" style={{ marginBottom: ".5rem" }}><Avatar name={p.display_name} url={p.avatar_url} size={64} /><div><h1 style={{ margin: 0 }}>Welcome back, {p.display_name.split(" ")[0]}</h1><p className="muted" style={{ margin: 0 }}>{[p.institution, p.city].filter(Boolean).join(" · ") || "Add your institution to see your campus first"}</p></div>
    <Link href="/listings" className="btn" style={{ marginLeft: "auto" }}>+ New listing</Link></div>
    <div className="grid">{stat(ls, "Active listings", "/listings")}{stat(pending.length + loopsOpen, "Awaiting your answer", "/matches")}{stat(active.length, "Active exchanges", "/matches")}{stat(done.length + (rep ? Math.max(0, rep.completed_exchanges - done.length) : 0), "Completed", "/reputation")}{stat(rep?.reputation_points ?? 0, "Reputation points", "/reputation")}{stat(rate === null ? "—" : rate + "%", "Response rate", "/matches")}</div>
    <div className="grid" style={{ marginTop: ".8rem", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
      <section className="card"><h2>Your journey</h2><div className="row"><div className="ring" style={{ background: `conic-gradient(var(--teal) ${complete * 3.6}deg, var(--line) 0)` }}><span>{complete}%</span></div><p className="muted" style={{ margin: 0 }}>profile complete</p></div>
        <ul className="steps">{steps.map(([t, ok, h]) => <li key={t}><Link href={h}>{ok ? "✅" : "⬜"} {t}</Link></li>)}</ul></section>
      <section className="card impact"><h2>Your impact</h2><p className="big">{hours} h</p><p className="muted">of skills received without spending a cent.</p><p>≈ <b>R{(hours * RATE).toLocaleString()}</b> saved</p><p className="muted" style={{ fontSize: ".78rem" }}>Illustrative estimate at R{RATE}/hour. Based on completed exchanges.</p></section></div>
    <h2 style={{ marginTop: "1.2rem" }}>Suggested matches for you</h2>
    {pending.length === 0 ? <p className="card">Nothing waiting. <Link href="/matches">Run matching</Link> after you post a listing.</p> : pending.slice(0, 3).map(m => { const o = mineA(m) ? m.pb : m.pa; return <Link key={m.id} href="/matches" className="card row" style={{ textDecoration: "none", color: "inherit" }}><Avatar name={o.display_name} url={o.avatar_url} size={42} /><div><b>{o.display_name}</b><div className="muted">You give {mineA(m) ? m.la.o.name : m.lb.o.name} · you get {mineA(m) ? m.lb.o.name : m.la.o.name}</div></div><span className="tag" style={{ marginLeft: "auto" }}>{m.score}/100</span></Link>; })}
    <h2 style={{ marginTop: "1.2rem" }}>Recent activity</h2>{nt.length === 0 ? <p className="card muted">No notifications yet.</p> : nt.map(n => <Link key={n.id} href="/notifications" className="card row" style={{ textDecoration: "none", color: "inherit", opacity: n.read_at ? 0.6 : 1 }}>{n.read_at ? "○" : "●"} <b>{NT[n.kind] ?? n.kind}</b><span className="muted" style={{ marginLeft: "auto" }}>{new Date(n.created_at).toLocaleDateString()}</span></Link>)}</>;
}
export default function Dashboard() { return <Shell><Inner /></Shell>; }
