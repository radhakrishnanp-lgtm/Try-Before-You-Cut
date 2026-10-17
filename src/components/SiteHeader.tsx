import Link from "next/link";
import { SignOut } from "./SignOut";

export function SiteHeader({ email, links = [] }: { email?: string | null; links?: { href: string; label: string }[] }) {
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden>K</span>
          <span className="brand-name">Keshkala</span>
        </Link>
        <nav className="row">
          {links.map((l) => (
            <Link key={l.href} className="btn btn-ghost btn-sm" href={l.href}>{l.label}</Link>
          ))}
          {email && <SignOut />}
        </nav>
      </div>
    </header>
  );
}
