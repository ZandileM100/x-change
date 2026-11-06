"use client";
import { useEffect, useState } from "react"; import { useParams } from "next/navigation"; import Shell, { useMe } from "@/components/Shell"; import { supabase } from "@/lib/supabase";
type Msg = { id: string; sender_id: string; body: string; created_at: string }; type F = { id: string; name: string; path: string; size_bytes: number };
const MAX = 10 * 1024 * 1024, OK = ["application/pdf", "image/png", "image/jpeg", "text/plain", "application/zip", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
function Inner() {
  const { id } = useParams<{ id: string }>(); const { me } = useMe();
  const [msgs, setMsgs] = useState<Msg[]>([]); const [text, setText] = useState(""); const [note, setNote] = useState(""); const [files, setFiles] = useState<F[]>([]); const [err, setErr] = useState(""); const [status, setStatus] = useState(""); const [stars, setStars] = useState(5);
  const [tasks, setTasks] = useState<{ id: string; title: string; done: boolean }[]>([]); const [newTask, setNewTask] = useState("");
  const loadTasks = () => supabase.from("vault_tasks").select("id,title,done").eq("match_id", id).order("created_at").then(r => setTasks(r.data ?? []));
  useEffect(() => { loadTasks(); }, [id]);
  async function addTask(e: React.FormEvent) { e.preventDefault(); if (!newTask.trim()) return; const { error } = await supabase.from("vault_tasks").insert({ match_id: id, title: newTask.trim(), created_by: me!.id }); setErr(error ? error.message : ""); if (!error) { setNewTask(""); loadTasks(); } }
  const toggleTask = async (t: { id: string; done: boolean }) => { await supabase.from("vault_tasks").update({ done: !t.done }).eq("id", t.id); loadTasks(); };
  const delTask = async (tid: string) => { await supabase.from("vault_tasks").delete().eq("id", tid); loadTasks(); };
  const doneCount = tasks.filter(t => t.done).length;
  useEffect(() => {
    supabase.from("matches").select("status").eq("id", id).single().then(r => r.error ? setErr("Vault not found or access denied.") : setStatus(r.data.status));
    supabase.from("messages").select("*").eq("match_id", id).order("created_at").then(r => setMsgs(r.data ?? []));
    supabase.from("vault_notes").select("body").eq("match_id", id).maybeSingle().then(r => setNote(r.data?.body ?? ""));
    supabase.from("vault_files").select("id,name,path,size_bytes").eq("match_id", id).then(r => setFiles(r.data ?? []));
    const ch = supabase.channel(`vault-${id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${id}` },
      p => setMsgs(m => m.some(x => x.id === (p.new as Msg).id) ? m : [...m, p.new as Msg])).subscribe(); // RLS limits events to participants
    return () => { supabase.removeChannel(ch); }; }, [id]);
  async function send(e: React.FormEvent) { e.preventDefault(); if (!text.trim()) return;
    const { error } = await supabase.from("messages").insert({ match_id: id, sender_id: me!.id, body: text.trim() }); if (error) setErr(error.message); else { setText(""); setErr(""); } }
  async function saveNote() { const { error } = await supabase.from("vault_notes").upsert({ match_id: id, body: note, updated_by: me!.id, updated_at: new Date().toISOString() }); setErr(error ? error.message : ""); }
  async function upload(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (!f) return;
    if (f.size > MAX) return setErr("File exceeds 10 MB."); if (!OK.includes(f.type)) return setErr("File type not allowed (PDF, PNG, JPG, TXT, DOCX, ZIP).");
    const path = `${id}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]/g, "_")}`;
    const up = await supabase.storage.from("vault").upload(path, f); if (up.error) return setErr(up.error.message);
    const { error } = await supabase.from("vault_files").insert({ match_id: id, uploader_id: me!.id, path, name: f.name, mime_type: f.type, size_bytes: f.size });
    if (error) return setErr(error.message); setErr(""); supabase.from("vault_files").select("id,name,path,size_bytes").eq("match_id", id).then(r => setFiles(r.data ?? [])); }
  async function download(f: F) { const { data, error } = await supabase.storage.from("vault").createSignedUrl(f.path, 60); if (error) setErr(error.message); else window.open(data.signedUrl); }
  async function rate() { const { error } = await supabase.rpc("rate_exchange", { m: id, stars, comment: "" }); setErr(error ? error.message : ""); if (!error) setStatus("completed (rated)"); }
  if (err && !status) return <p className="card err" role="alert">{err}</p>;
  return <><h1>Private vault</h1><p className="muted">Exchange status: {status}</p>{err && <p role="alert" className="err">{err}</p>}
    <section className="card" aria-label="Chat"><h2>Chat</h2><div aria-live="polite">{msgs.map(m => <p key={m.id}><b>{m.sender_id === me?.id ? "You" : "Partner"}</b> <span className="muted">{new Date(m.created_at).toLocaleString()}</span><br />{m.body}</p>)}</div>
      {["accepted", "completed"].includes(status) && <form onSubmit={send}><label htmlFor="m">Message</label><input id="m" maxLength={2000} value={text} onChange={e => setText(e.target.value)} /><button>Send</button></form>}</section>
    <section className="card" aria-label="Checklist"><h2>Exchange checklist</h2><p className="muted">{tasks.length ? `${doneCount} of ${tasks.length} done` : "Agree on what each person will deliver."}</p>
      {tasks.length > 0 && <progress value={doneCount} max={tasks.length} style={{ width: "100%" }} aria-label="Checklist progress" />}
      {tasks.map(t => <p key={t.id} className="row"><label style={{ margin: 0, fontWeight: 500 }}><input type="checkbox" style={{ width: "auto" }} checked={t.done} onChange={() => toggleTask(t)} /> <span style={{ textDecoration: t.done ? "line-through" : "none" }}>{t.title}</span></label><button className="sec" style={{ marginLeft: "auto" }} onClick={() => delTask(t.id)} aria-label={`Remove ${t.title}`}>×</button></p>)}
      {status === "accepted" && <form onSubmit={addTask}><label htmlFor="nt">Add a task</label><input id="nt" maxLength={120} value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="e.g. Draft the logo concepts" /><button>Add task</button></form>}</section>
    <section className="card"><h2>Shared notes</h2><p className="muted">Saved notes, not live co-editing: the last save wins.</p><label htmlFor="n">Notes</label><textarea id="n" rows={6} maxLength={20000} value={note} onChange={e => setNote(e.target.value)} /><button onClick={saveNote}>Save notes</button></section>
    <section className="card"><h2>Files</h2><label htmlFor="f">Upload (max 10 MB)</label><input id="f" type="file" onChange={upload} />{files.length === 0 && <p className="muted">No files yet.</p>}{files.map(f => <p key={f.id}>{f.name} ({Math.round(f.size_bytes / 1024)} KB) <button className="sec" onClick={() => download(f)}>Download</button></p>)}</section>
    {status === "completed" && <section className="card"><h2>Rate this exchange</h2><label htmlFor="st">Stars</label><select id="st" value={stars} onChange={e => setStars(+e.target.value)}>{[5, 4, 3, 2, 1].map(n => <option key={n}>{n}</option>)}</select><button onClick={rate}>Submit rating</button></section>}</>;
}
export default function Vault() { return <Shell><Inner /></Shell>; }
