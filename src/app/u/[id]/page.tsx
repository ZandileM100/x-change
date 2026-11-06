"use client";
import { useEffect, useState } from "react"; import { useParams } from "next/navigation"; import Shell from "@/components/Shell"; import Avatar from "@/components/Avatar"; import { supabase } from "@/lib/supabase";
type P = { display_name: string; bio: string | null; institution: string | null; city: string | null; avatar_url: string | null };
function Inner() {
  const { id } = useParams<{ id: string }>(); const [p, setP] = useState<P | null>(null); const [miss, setMiss] = useState(false);
  const [v, setV] = useState<{ skill_name: string; completed: number }[]>([]); const [rep, setRep] = useState<{ reputation_points: number; completed_exchanges: number; avg_rating: number | null; has_starter_badge: boolean } | null>(null);
  const [ls, setLs] = useState<{ id: string; title: string; o: { name: string }; r: { name: string } }[]>([]);
  useEffect(() => {
    supabase.from("profiles").select("display_name,bio,institution,city,avatar_url").eq("id", id).maybeSingle().then(r => r.data ? setP(r.data) : setMiss(true));
    supabase.from("verified_skills").select("skill_name,completed").eq("user_id", id).then(r => setV(r.data ?? []));
    supabase.from("user_reputation").select("reputation_points,completed_exchanges,avg_rating,has_starter_badge").eq("user_id", id).maybeSingle().then(r => setRep(r.data));
    supabase.from("listings").select("id,title,o:skills!offered_skill_id(name),r:skills!requested_skill_id(name)").eq("owner_id", id).eq("status", "active").then(r => setLs((r.data as unknown as typeof ls) ?? [])); }, [id]);
  if (miss) return <p className="card">Profile not found.</p>; if (!p) return <p className="muted">Loading…</p>;
  return <><div className="card row"><Avatar name={p.display_name} url={p.avatar_url} size={88} /><div><h1 style={{ margin: 0 }}>{p.display_name}</h1>
    <p className="muted">{[p.institution, p.city].filter(Boolean).join(" · ") || "No institution or city shared"}</p>{rep?.has_starter_badge && <span className="tag">🏅 Starter Badge</span>}</div></div>
    {p.bio && <div className="card"><p>{p.bio}</p></div>}
    <div className="grid"><div className="card"><h3>{rep?.reputation_points ?? 0}</h3><p className="muted">Reputation points</p></div><div className="card"><h3>{rep?.completed_exchanges ?? 0}</h3><p className="muted">Verified exchanges</p></div><div className="card"><h3>{rep?.avg_rating ?? "—"}</h3><p className="muted">Average rating</p></div></div>
    <h2 style={{ marginTop: "1.2rem" }}>Verified skills</h2><p className="muted">Earned only by completing an exchange for that skill.</p>
    {v.length === 0 ? <p className="card">No verified skills yet.</p> : <p>{v.map(x => <span className="tag completed" style={{ marginRight: ".4rem" }} key={x.skill_name}>✔ {x.skill_name} ×{x.completed}</span>)}</p>}
    <h2>Active listings</h2>{ls.length === 0 && <p className="card">None.</p>}{ls.map(l => <p className="card" key={l.id}><b>{l.title}</b><br /><span className="muted">Offers {l.o?.name} · wants {l.r?.name}</span></p>)}</>;
}
export default function Public() { return <Shell auth={false}><Inner /></Shell>; }
