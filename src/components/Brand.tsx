import Link from "next/link";

/** Try-Before-You-Cut logo: scissors mark + wordmark. */
export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="url(#tbyc-g)" strokeWidth="1.7" strokeLinecap="round">
        <defs>
          <linearGradient id="tbyc-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f6dfaf" />
            <stop offset="1" stopColor="#b08447" />
          </linearGradient>
        </defs>
        <circle cx="6" cy="17.5" r="3" />
        <circle cx="18" cy="17.5" r="3" />
        <path d="M8.2 15.4 18.5 3.5M15.8 15.4 5.5 3.5" />
      </svg>
    </span>
  );
}

export function Wordmark() {
  return (
    <span className="brand-name">
      Try-Before-<b>You-Cut</b>
    </span>
  );
}

export function BrandLink({ href = "/" }: { href?: string }) {
  return (
    <Link className="brand" href={href} aria-label="Try-Before-You-Cut home">
      <BrandMark />
      <Wordmark />
    </Link>
  );
}
