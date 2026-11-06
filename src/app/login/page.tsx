"use client";
import { useEffect, useState } from "react"; import Shell from "@/components/Shell"; import { supabase } from "@/lib/supabase";
export default function Login() {
  const [mode, setMode] = useState<"login"|"register"|"reset">("login"); const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [msg, setMsg] = useState<{t:string;ok:boolean}|null>(null);
  const [prov, setProv] = useState<{ google: boolean; github: boolean } | null>(null);
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" } })
      .then(r => r.json()).then(j => setProv({ google: !!j.external?.google, github: !!j.external?.github })).catch(() => setProv({ google: false, github: false }));
    const q = new URLSearchParams(location.hash.slice(1) || location.search); const d = q.get("error_description");
    if (d) setMsg({ t: d.replace(/\+/g, " "), ok: false }); }, []);
  async function submit(e: React.FormEvent) { e.preventDefault(); setMsg(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setMsg({ t: "Enter a valid email.", ok: false });
    if (mode !== "reset" && pw.length < 8) return setMsg({ t: "Password must be at least 8 characters.", ok: false });
    const r = mode === "login" ? await supabase.auth.signInWithPassword({ email, password: pw })
      : mode === "register" ? await supabase.auth.signUp({ email, password: pw })
      : await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/login" });
    if (r.error) return setMsg({ t: r.error.message, ok: false });
    if (mode === "login") location.href = "/dashboard"; else setMsg({ t: mode === "register" ? "Check your email to confirm your account (if confirmation is enabled)." : "If the account exists, a reset email was sent.", ok: true }); }
  async function oauth(p: "google" | "github") {
    const name = p === "google" ? "Google" : "GitHub";
    if (!prov?.[p]) return setMsg({ t: `${name} sign-in is not enabled for this project yet. The site owner must switch it on in Supabase (Authentication, Sign In / Providers) and add the ${name} client ID and secret. Use email and password for now.`, ok: false });
    const { error } = await supabase.auth.signInWithOAuth({ provider: p, options: { redirectTo: location.origin + "/dashboard" } });
    if (error) setMsg({ t: error.message, ok: false }); }
  return <Shell auth={false}><h1>{mode === "login" ? "Log in" : mode === "register" ? "Create account" : "Reset password"}</h1>
    <form className="card" onSubmit={submit} noValidate><label htmlFor="e">Email</label><input id="e" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
      {mode !== "reset" && <><label htmlFor="p">Password</label><input id="p" type="password" autoComplete={mode==="login"?"current-password":"new-password"} value={pw} onChange={e => setPw(e.target.value)} /></>}
      <button>{mode === "login" ? "Log in" : mode === "register" ? "Register" : "Send reset link"}</button>
      {msg && <p role="alert" className={msg.ok ? "ok" : "err"}>{msg.t}</p>}</form>
    <p><button className="sec" onClick={() => setMode("login")}>Log in</button><button className="sec" onClick={() => setMode("register")}>Register</button><button className="sec" onClick={() => setMode("reset")}>Forgot password</button></p>
    <p><button className="sec" onClick={() => oauth("google")}>Continue with Google{prov && !prov.google ? " (not set up)" : ""}</button><button className="sec" onClick={() => oauth("github")}>Continue with GitHub{prov && !prov.github ? " (not set up)" : ""}</button></p></Shell>; }
