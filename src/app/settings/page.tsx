"use client";
import { useState } from "react"; import Link from "next/link"; import Shell, { useMe } from "@/components/Shell"; import { supabase } from "@/lib/supabase";
function Inner() {
  const { me } = useMe(); const [pw, setPw] = useState(""); const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  async function changePw(e: React.FormEvent) { e.preventDefault(); if (pw.length < 8) return setMsg({ t: "Password must be at least 8 characters.", ok: false });
    const { error } = await supabase.auth.updateUser({ password: pw }); setMsg(error ? { t: error.message, ok: false } : { t: "Password updated.", ok: true }); if (!error) setPw(""); }
  async function others() { const { error } = await supabase.auth.signOut({ scope: "others" }); setMsg(error ? { t: error.message, ok: false } : { t: "Signed out of all other devices.", ok: true }); }
  async function exportData() { const id = me!.id; const get = async (t: string, col: string) => (await supabase.from(t).select("*").eq(col, id)).data ?? [];
    const data = { exported_at: new Date().toISOString(), email: me!.email, profile: await get("profiles", "id"), listings: await get("listings", "owner_id"), notifications: await get("notifications", "user_id"), feedback: await get("feedback", "user_id"), ratings_given: await get("ratings", "rater_id") };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = "xchange-it-my-data.json"; a.click(); URL.revokeObjectURL(url); }
  return <><h1>Settings</h1><p role="status" className={msg?.ok ? "ok" : "err"}>{msg?.t}</p>
    <div className="card"><h2>Account</h2><p>Signed in as <b>{me?.email}</b>. Your email is never shown publicly.</p><p><Link href="/profile">Edit profile and picture</Link></p></div>
    <form className="card" onSubmit={changePw}><h2>Change password</h2><label htmlFor="pw">New password</label><input id="pw" type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} /><button>Update password</button></form>
    <div className="card"><h2>Security</h2><p className="muted">Sign out everywhere else if you used a shared computer.</p><button className="sec" onClick={others}>Sign out other devices</button></div>
    <div className="card"><h2>Your data</h2><p className="muted">Download a copy of your profile, listings, notifications, feedback and ratings as JSON. To delete your account, submit a request through <Link href="/feedback">Feedback</Link>.</p><button className="sec" onClick={exportData}>Download my data</button></div>
    <div className="card"><h2>Notifications</h2><p className="muted">In-app notifications only. Email and push are not enabled.</p></div></>;
}
export default function Settings() { return <Shell><Inner /></Shell>; }
