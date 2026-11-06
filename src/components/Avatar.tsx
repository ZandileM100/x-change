export default function Avatar({ name, url, size = 40 }: { name?: string | null; url?: string | null; size?: number }) {
  const initials = (name ?? "?").trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join("") || "?";
  const style = { width: size, height: size, fontSize: size * 0.4 };
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img className="avatar" style={style} src={url} alt={name ? `${name}'s profile picture` : "Profile picture"} />
    : <span className="avatar" style={style} aria-hidden="true">{initials}</span>;
}
