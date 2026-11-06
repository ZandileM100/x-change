"use client"; import Shell from "@/components/Shell";
export default function Legal() { return <Shell auth={false}><h1>Privacy & Terms</h1>
  <p className="card err" role="note"><b>Starter text. Must be reviewed by a qualified person before production use.</b></p>
  <h2>Privacy</h2><p>We store your account email, display name, optional bio, institution and city, your listings, exchange records, messages, notes, uploaded files, ratings and reputation. Your email is never shown publicly. Vault content is visible only to the two participants and, for moderation, administrators may see exchange metadata. You can ask to delete your account data.</p>
  <h2>Terms</h2><p>Use Xchange-It honestly. Deliver what you agree to. Do not upload unlawful or harmful files, harass others, or manipulate reputation. Exchanges are between users; Xchange-It does not guarantee outcomes. Accounts may be suspended for abuse.</p></Shell>; }
