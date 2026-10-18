import Link from "next/link";
import { BrandLink } from "./Brand";
import { SignOut } from "./SignOut";

export function SiteHeader({ signedIn, who, links = [] }: { signedIn?: boolean; who?: string; links?: { href: string; label: string }[] }) {
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <BrandLink />
        <nav className="row">
          {who && <span className="small muted">{who}</span>}
          {links.map((l) => (
            <Link key={l.href} className="btn btn-ghost btn-sm" href={l.href}>{l.label}</Link>
          ))}
          {signedIn && <SignOut />}
        </nav>
      </div>
    </header>
  );
}
