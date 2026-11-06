"use client";
import { useEffect, useState } from "react"; import Link from "next/link"; import Shell from "@/components/Shell"; import { supabase } from "@/lib/supabase";
type N = { id: string; kind: string; match_id: string | null; read_at: string | null; created_at: string };
const text: Record<string, string> = { match_suggested: "New reciprocal match suggested", loop_suggested: "New three-way loop suggested", awarded: "Exchange completed: reputation points awarded", reminder_day7: "Reminder: an exchange is waiting (day 7 of 14)", reminder_day13: "Final reminder: an exchange expires tomorrow (day 13 of 14)" };
function Inner() {
  const [ns, setNs] = useState<N[]>([]); const load = () => supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50).then(r => setNs(r.data ?? [])); useEffect(() => { load(); }, []);
  const read = async (id: string) => { await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id); load(); };
  return <><h1>Notifications</h1><p className="muted">In-app only. Email and push are not configured.</p>{ns.length === 0 && <p className="card">You're all caught up.</p>}
    {ns.map(n => <div className="card" key={n.id} style={{ opacity: n.read_at ? 0.6 : 1 }}><b>{text[n.kind] ?? n.kind}</b> <span className="muted">{new Date(n.created_at).toLocaleString()}</span><br />
      {(n.match_id || (n as { loop_id?: string }).loop_id) && <Link href="/matches">View matches</Link>} {!n.read_at && <button className="sec" onClick={() => read(n.id)}>Mark read</button>}</div>)}</>;
}
export default function Notifications() { return <Shell><Inner /></Shell>; }
