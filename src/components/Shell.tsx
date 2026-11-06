"use client";
import Link from "next/link"; import { usePathname } from "next/navigation";
import { useEffect, useState, ReactNode } from "react";
import { supabase, configured } from "@/lib/supabase"; import Avatar from "./Avatar"; import Logo from "./Logo";
export type Me = { id: string; email?: string };
export function useMe() {
  const [me, setMe] = useState<Me | null>(null); const [ready, setReady] = useState(false);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => { setMe(data.user ? { id: data.user.id, email: data.user.email } : null); setReady(true); }); }, []);
  return { me, ready };
}
const NAV = [["/dashboard", "Dashboard"], ["/listings", "Listings"], ["/matches", "Matches"], ["/notifications", "Notifications"], ["/reputation", "Reputation"], ["/profile", "Profile"], ["/feedback", "Feedback"], ["/settings", "Settings"]];
export default function Shell({ children, auth = true }: { children: ReactNode; auth?: boolean }) {
  const { me, ready } = useMe(); const path = usePathname();
  const [unread, setUnread] = useState(0); const [prof, setProf] = useState<{ display_name: string; avatar_url: string | null; role: string } | null>(null);
  useEffect(() => { if (!me) return;
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null).then(r => setUnread(r.count ?? 0));
    supabase.from("profiles").select("display_name,avatar_url,role").eq("id", me.id).single().then(r => setProf(r.data)); }, [me]);
  const items = me ? [...NAV, ...(prof?.role === "admin" ? [["/admin", "Admin"]] : []), ["/legal", "Privacy & Terms"]] : [["/", "Home"], ["/listings", "Explore skills"], ["/about", "About"], ["/legal", "Privacy & Terms"]];
  return (<div className="app">
    <aside className="side"><Link href={me ? "/dashboard" : "/"} className="brand"><Logo /></Link>
      <nav aria-label="Main">{items.map(([h, l]) => <Link key={h} href={h} className={path === h ? "active" : ""} aria-current={path === h ? "page" : undefined}>{l}{h === "/notifications" && unread > 0 && <span className="pill">{unread}</span>}</Link>)}</nav>
      <div className="me">{me ? <><Avatar name={prof?.display_name ?? me.email} url={prof?.avatar_url} size={36} /><div><b>{prof?.display_name ?? me.email}</b>
        <button className="link" onClick={async () => { await supabase.auth.signOut(); location.href = "/login"; }}>Log out</button></div></> : <Link href="/login" className="btn">Log in</Link>}</div></aside>
    <div className="content"><main>{!configured && <p className="card err" role="alert">Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.</p>}
      {!ready ? <p className="muted">Loading…</p> : auth && !me ? <div className="card"><h2>Please log in</h2><p>You need an account to view this page.</p><Link href="/login" className="btn">Log in</Link></div> : children}</main>
      <footer className="foot">Xchange-It · Sol Plaatje University project (NPRJ740)</footer></div></div>);
}
