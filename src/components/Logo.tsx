export default function Logo({ light = true }: { light?: boolean }) {
  return <span className="logo" aria-label="Xchange-It">
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0f8b8d" />
      <path d="M8 12h13l-3-3M24 20H11l3 3" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
    <span style={{ color: light ? "#fff" : "var(--navy)" }}>Xchange<b>-It</b></span></span>;
}
