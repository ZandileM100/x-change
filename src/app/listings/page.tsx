"use client";
import { useEffect, useState } from "react"; import Link from "next/link"; import Shell, { useMe } from "@/components/Shell"; import Avatar from "@/components/Avatar"; import { supabase } from "@/lib/supabase";
type Skill = { id: string; name: string };
type Row = { id: string; title: string; description: string; status: string; owner_id: string; est_hours: number; days: string[]; format: string; o: { name: string }; r: { name: string }; profiles: { display_name: string; avatar_url: string | null; institution: string | null } };
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]; const blank = { title: "", description: "", offered: "", requested: "", hours: "2", days: [] as string[], availability: "", format: "online" };
const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();
function Inner() {
  const { me } = useMe(); const [skills, setSkills] = useState<Skill[]>([]); const [rows, setRows] = useState<Row[]>([]); const [q, setQ] = useState(""); const [msg, setMsg] = useState("");
  const [campus, setCampus] = useState(""); const [onlyCampus, setOnlyCampus] = useState(false); const [editing, setEditing] = useState<string | null>(null); const [f, setF] = useState(blank);
  const load = () => supabase.from("listings").select("id,title,description,status,owner_id,est_hours,days,format,o:skills!offered_skill_id(name),r:skills!requested_skill_id(name),profiles(display_name,avatar_url,institution)").order("created_at", { ascending: false }).limit(100).then(r => setRows((r.data as unknown as Row[]) ?? []));
  useEffect(() => { supabase.from("skills").select("id,name").eq("status", "approved").order("name").then(r => setSkills(r.data ?? [])); load(); }, []);
  useEffect(() => { if (me) supabase.from("profiles").select("institution").eq("id", me.id).single().then(r => setCampus(r.data?.institution ?? "")); }, [me]);
  async function save(e: React.FormEvent) { e.preventDefault(); setMsg(""); if (!me) return setMsg("Log in to create a listing.");
    const hrs = parseFloat(f.hours);
    if (f.title.trim().length < 3 || !f.description.trim() || !f.offered || !f.requested) return setMsg("Fill in title, description, offered and requested skills.");
    if (f.offered === f.requested) return setMsg("Offered and requested skills must differ."); if (!(hrs > 0 && hrs <= 200)) return setMsg("Estimated hours must be between 0.5 and 200.");
    const body = { title: f.title.trim(), description: f.description.trim(), offered_skill_id: f.offered, requested_skill_id: f.requested, est_hours: hrs, days: f.days, availability: f.availability, format: f.format };
    const { error } = editing ? await supabase.from("listings").update(body).eq("id", editing) : await supabase.from("listings").insert({ ...body, owner_id: me.id });
    if (error) return setMsg(error.message); setMsg(editing ? "Listing updated." : "Listing created. Open Matches to find partners."); setEditing(null); setF(blank); load(); }
  async function edit(r: Row) { const { data } = await supabase.from("listings").select("offered_skill_id,requested_skill_id,availability").eq("id", r.id).single();
    setEditing(r.id); setF({ title: r.title, description: r.description, offered: data?.offered_skill_id ?? "", requested: data?.requested_skill_id ?? "", hours: String(r.est_hours), days: r.days ?? [], availability: data?.availability ?? "", format: r.format }); window.scrollTo({ top: 0, behavior: "smooth" }); }
  const toggle = async (r: Row) => { await supabase.from("listings").update({ status: r.status === "active" ? "inactive" : "active" }).eq("id", r.id); load(); };
  const del = async (r: Row) => { if (confirm("Delete this listing? This cannot be undone.")) { await supabase.from("listings").delete().eq("id", r.id); load(); } };
  const mineCampus = (r: Row) => !!campus && norm(r.profiles?.institution) === norm(campus);
  const shown = rows.filter(r => `${r.title} ${r.o?.name} ${r.r?.name}`.toLowerCase().includes(q.toLowerCase())).filter(r => !onlyCampus || mineCampus(r)).sort((a, b) => Number(mineCampus(b)) - Number(mineCampus(a)));
  return <><h1>Listings</h1>
    <form className="card" onSubmit={save}><h2>{editing ? "Edit listing" : "Create listing"}</h2>
      <label htmlFor="t">Title</label><input id="t" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
      <label htmlFor="d">Description</label><textarea id="d" rows={3} maxLength={1000} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
      <div className="grid"><div><label htmlFor="o">I offer</label><select id="o" value={f.offered} onChange={e => setF({ ...f, offered: e.target.value })}><option value="">Select…</option>{skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div><label htmlFor="r">I want</label><select id="r" value={f.requested} onChange={e => setF({ ...f, requested: e.target.value })}><option value="">Select…</option>{skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div><label htmlFor="h">Estimated hours of work</label><input id="h" type="number" min="0.5" max="200" step="0.5" value={f.hours} onChange={e => setF({ ...f, hours: e.target.value })} /></div>
        <div><label htmlFor="fm">Format</label><select id="fm" value={f.format} onChange={e => setF({ ...f, format: e.target.value })}><option value="online">Online</option><option value="in_person">In person</option><option value="either">Either</option></select></div></div>
      <fieldset style={{ border: 0, padding: 0, margin: ".7rem 0 0" }}><legend style={{ fontWeight: 600, fontSize: ".92rem" }}>Days you are usually free (leave empty if flexible)</legend>
        {DAYS.map(d => <label key={d} style={{ display: "inline-flex", gap: ".3rem", margin: ".3rem .8rem .3rem 0", fontWeight: 500, textTransform: "capitalize" }}><input type="checkbox" style={{ width: "auto" }} checked={f.days.includes(d)} onChange={e => setF({ ...f, days: e.target.checked ? [...f.days, d] : f.days.filter(x => x !== d) })} />{d}</label>)}</fieldset>
      <label htmlFor="a">Availability notes</label><input id="a" value={f.availability} onChange={e => setF({ ...f, availability: e.target.value })} placeholder="e.g. evenings after 18:00" />
      <button>{editing ? "Save changes" : "Save listing"}</button>{editing && <button type="button" className="sec" onClick={() => { setEditing(null); setF(blank); }}>Cancel</button>}<span role="status" className={msg.includes("created") || msg.includes("updated") ? "ok" : "err"}>{msg}</span></form>
    <div className="grid"><div><label htmlFor="s">Search skills</label><input id="s" value={q} onChange={e => setQ(e.target.value)} /></div>
      {campus && <div><label style={{ marginTop: "1.9rem", display: "flex", gap: ".4rem", fontWeight: 500 }}><input type="checkbox" style={{ width: "auto" }} checked={onlyCampus} onChange={e => setOnlyCampus(e.target.checked)} />Only my campus ({campus})</label></div>}</div>
    {!campus && me && <p className="muted">Add your institution on your <Link href="/profile">profile</Link> to see your campus first.</p>}
    {shown.length === 0 && <p className="card">No listings found.</p>}
    {shown.map(r => <article className="card" key={r.id}><div className="row"><Avatar name={r.profiles?.display_name} url={r.profiles?.avatar_url} size={36} />
      <Link href={`/u/${r.owner_id}`}><b>{r.profiles?.display_name}</b></Link>{mineCampus(r) && <span className="tag">Your campus</span>}<span className={`tag ${r.status === "active" ? "" : "declined"}`} style={{ marginLeft: "auto" }}>{r.status}</span></div>
      <h3>{r.title}</h3><p>Offers <b>{r.o?.name}</b> · wants <b>{r.r?.name}</b></p><p className="muted">~{r.est_hours} h · {r.format.replace("_", " ")}{r.days?.length ? ` · ${r.days.join(", ")}` : " · flexible days"}</p><p>{r.description}</p>
      {me?.id === r.owner_id && <><button className="sec" onClick={() => edit(r)}>Edit</button><button className="sec" onClick={() => toggle(r)}>{r.status === "active" ? "Deactivate" : "Activate"}</button><button className="sec" onClick={() => del(r)}>Delete</button></>}</article>)}</>;
}
export default function Listings() { return <Shell auth={false}><Inner /></Shell>; }
