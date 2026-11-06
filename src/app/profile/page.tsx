"use client";
import { useEffect, useState } from "react"; import Shell, { useMe } from "@/components/Shell"; import Avatar from "@/components/Avatar"; import { supabase } from "@/lib/supabase";
const OK = ["image/png", "image/jpeg", "image/webp"]; const MAX = 2 * 1024 * 1024;
function Inner() {
  const { me } = useMe(); const [p, setP] = useState({ display_name: "", bio: "", institution: "", city: "" }); const [avatar, setAvatar] = useState<string | null>(null); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (me) supabase.from("profiles").select("display_name,bio,institution,city,avatar_url").eq("id", me.id).single().then(r => { if (r.data) { setP({ display_name: r.data.display_name ?? "", bio: r.data.bio ?? "", institution: r.data.institution ?? "", city: r.data.city ?? "" }); setAvatar(r.data.avatar_url); } }); }, [me]);
  const done = Math.min(100, Object.values(p).filter(v => v.trim()).length * 20 + (avatar ? 20 : 0));
  async function save(e: React.FormEvent) { e.preventDefault(); if (p.display_name.trim().length < 2) return setMsg("Display name must be at least 2 characters.");
    const { error } = await supabase.from("profiles").update({ display_name: p.display_name.trim(), bio: p.bio || null, institution: p.institution || null, city: p.city || null }).eq("id", me!.id); setMsg(error ? error.message : "Profile saved."); }
  async function upload(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (!f) return; setMsg("");
    if (!OK.includes(f.type)) return setMsg("Use a PNG, JPG or WebP image."); if (f.size > MAX) return setMsg("Image must be 2 MB or smaller.");
    setBusy(true); const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg"; const path = `${me!.id}/avatar.${ext}`;
    const up = await supabase.storage.from("avatars").upload(path, f, { upsert: true, contentType: f.type }); if (up.error) { setBusy(false); return setMsg(up.error.message); }
    const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl + `?v=${Date.now()}`;
    const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", me!.id); setBusy(false); if (error) return setMsg(error.message); setAvatar(url); setMsg("Profile picture updated."); }
  async function remove() { setBusy(true); await supabase.from("profiles").update({ avatar_url: null }).eq("id", me!.id); setAvatar(null); setBusy(false); setMsg("Picture removed."); }
  return <><h1>My profile</h1>
    <div className="card row"><Avatar name={p.display_name} url={avatar} size={88} /><div><h2>{p.display_name || "Your name"}</h2><p className="muted">Profile completion: {done}%</p>
      <label htmlFor="av" className="btn sec" style={{ cursor: "pointer" }}>{avatar ? "Change picture" : "Add picture (optional)"}</label><input id="av" type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} disabled={busy} style={{ position: "absolute", opacity: 0, width: 1, height: 1 }} />
      {avatar && <button className="sec" onClick={remove} disabled={busy}>Remove</button>}<p className="muted">PNG, JPG or WebP, up to 2 MB. Shown to people you match with.</p></div></div>
    <form className="card" onSubmit={save}><label htmlFor="n">Display name</label><input id="n" value={p.display_name} onChange={e => setP({ ...p, display_name: e.target.value })} />
      <label htmlFor="b">Biography</label><textarea id="b" rows={3} maxLength={500} value={p.bio} onChange={e => setP({ ...p, bio: e.target.value })} />
      <label htmlFor="i">Institution or business</label><input id="i" value={p.institution} onChange={e => setP({ ...p, institution: e.target.value })} />
      <label htmlFor="c">City (general location only)</label><input id="c" value={p.city} onChange={e => setP({ ...p, city: e.target.value })} />
      <button>Save changes</button></form><p role="status" className={msg.includes("updated") || msg.includes("saved") ? "ok" : "err"}>{msg}</p></>;
}
export default function Profile() { return <Shell><Inner /></Shell>; }
