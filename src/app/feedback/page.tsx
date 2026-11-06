"use client";
import { useEffect, useState } from "react"; import Shell, { useMe } from "@/components/Shell"; import { supabase } from "@/lib/supabase";
type Fb = { id: string; title: string; kind: string; status: string; created_at: string };
function Inner() {
  const { me } = useMe(); const [rows, setRows] = useState<Fb[]>([]); const [f, setF] = useState({ kind: "bug", title: "", description: "", related_page: "" }); const [msg, setMsg] = useState("");
  const load = () => supabase.from("feedback").select("id,title,kind,status,created_at").order("created_at", { ascending: false }).then(r => setRows(r.data ?? [])); useEffect(() => { load(); }, []);
  async function submit(e: React.FormEvent) { e.preventDefault(); if (f.title.trim().length < 3 || !f.description.trim()) return setMsg("Add a title (3+ characters) and a description.");
    const { error } = await supabase.from("feedback").insert({ ...f, user_id: me!.id, related_page: f.related_page || null }); setMsg(error ? error.message : "Thanks, feedback submitted."); if (!error) { setF({ ...f, title: "", description: "" }); load(); } }
  return <><h1>Feedback</h1><form className="card" onSubmit={submit}><label htmlFor="k">Type</label><select id="k" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}><option value="bug">Bug</option><option value="usability">Usability</option><option value="category_suggestion">Skill category suggestion</option><option value="suggestion">Suggestion</option></select>
    <label htmlFor="t">Title</label><input id="t" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /><label htmlFor="d">Description</label><textarea id="d" maxLength={2000} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
    <label htmlFor="p">Related page (optional)</label><input id="p" value={f.related_page} onChange={e => setF({ ...f, related_page: e.target.value })} /><button>Submit</button><p role="status">{msg}</p></form>
    <h2>My submissions</h2>{rows.length === 0 && <p className="card">None yet.</p>}{rows.map(r => <p className="card" key={r.id}>{r.title} · {r.kind} · <b>{r.status}</b> · {new Date(r.created_at).toLocaleDateString()}</p>)}</>;
}
export default function Feedback() { return <Shell><Inner /></Shell>; }
