"use client";
import { useEffect, useState } from "react"; import Shell, { useMe } from "@/components/Shell"; import { supabase } from "@/lib/supabase";
type R = { reputation_points: number; completed_exchanges: number; has_starter_badge: boolean; avg_rating: number | null };
function Inner() {
  const { me } = useMe(); const [r, setR] = useState<R | null>(null); const [fb, setFb] = useState<{ stars: number; comment: string | null }[]>([]);
  useEffect(() => { if (!me) return; supabase.from("user_reputation").select("*").eq("user_id", me.id).single().then(x => setR(x.data)); supabase.from("ratings").select("stars,comment").eq("ratee_id", me.id).then(x => setFb(x.data ?? [])); }, [me]);
  if (!r) return <p>Loading…</p>;
  return <><h1>Reputation</h1>
    {r.completed_exchanges === 0 ? <p className="card">No completed exchanges yet. Complete your first verified exchange to earn the Starter Badge.</p> :
      <div className="card"><p><b>{r.reputation_points}</b> points · <b>{r.completed_exchanges}</b> verified exchanges · rating {r.avg_rating ?? "none yet"}</p>{r.has_starter_badge && <p>🏅 Starter Badge</p>}</div>}
    <div className="card"><h2>How the score works</h2><p>You earn 10 points per exchange, only after both participants confirm it, and only once per exchange. Ratings come only from your exchange partner and do not change points. The Starter Badge is granted after your first verified exchange.</p></div>
    <h2>Feedback received</h2>{fb.length === 0 && <p className="muted">None yet.</p>}{fb.map((f, i) => <p className="card" key={i}>{"★".repeat(f.stars)} {f.comment}</p>)}</>;
}
export default function Reputation() { return <Shell><Inner /></Shell>; }
