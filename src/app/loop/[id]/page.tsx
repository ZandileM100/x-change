"use client";
import { useEffect, useState } from "react"; import { useParams } from "next/navigation"; import Link from "next/link"; import Shell, { useMe } from "@/components/Shell"; import { supabase } from "@/lib/supabase";
type Msg = { id: string; sender_id: string; body: string; created_at: string };
function Inner() {
  const { id } = useParams<{ id: string }>(); const { me } = useMe(); const [msgs, setMsgs] = useState<Msg[]>([]); const [names, setNames] = useState<Record<string, string>>({}); const [text, setText] = useState(""); const [status, setStatus] = useState(""); const [err, setErr] = useState("");
  const load = () => supabase.from("loop_messages").select("*").eq("loop_id", id).order("created_at").then(r => setMsgs(r.data ?? []));
  useEffect(() => { supabase.from("loops").select("status").eq("id", id).single().then(r => r.error ? setErr("Loop not found or access denied.") : setStatus(r.data.status));
    supabase.from("loop_members").select("user_id,profiles(display_name)").eq("loop_id", id).then(r => setNames(Object.fromEntries((r.data ?? []).map((m: { user_id: string; profiles: unknown }) => [m.user_id, (m.profiles as { display_name: string })?.display_name]))));
    load(); const ch = supabase.channel(`loop-${id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "loop_messages", filter: `loop_id=eq.${id}` }, () => load()).subscribe(); return () => { supabase.removeChannel(ch); }; }, [id]);
  async function send(e: React.FormEvent) { e.preventDefault(); if (!text.trim()) return; const { error } = await supabase.from("loop_messages").insert({ loop_id: id, sender_id: me!.id, body: text.trim() }); if (error) setErr(error.message); else { setText(""); setErr(""); load(); } }
  if (err && !status) return <p className="card err" role="alert">{err}</p>;
  return <><h1>Loop chat</h1><p className="muted">Three people, one loop. Status: <span className="tag">{status}</span> · <Link href="/matches">Back to matches</Link></p>{err && <p className="err" role="alert">{err}</p>}
    <section className="card" aria-live="polite">{msgs.length === 0 && <p className="muted">No messages yet. Say hello and agree who delivers what and when.</p>}
      {msgs.map(m => <p key={m.id}><b>{m.sender_id === me?.id ? "You" : names[m.sender_id] ?? "Member"}</b> <span className="muted">{new Date(m.created_at).toLocaleString()}</span><br />{m.body}</p>)}
      {["accepted", "completed"].includes(status) && <form onSubmit={send}><label htmlFor="m">Message</label><input id="m" maxLength={2000} value={text} onChange={e => setText(e.target.value)} /><button>Send</button></form>}</section></>;
}
export default function LoopPage() { return <Shell><Inner /></Shell>; }
