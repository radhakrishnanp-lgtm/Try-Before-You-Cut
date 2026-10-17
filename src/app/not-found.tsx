import Link from "next/link";

export default function NotFound() {
  return (
    <main className="narrow flow center">
      <div className="eyebrow">404</div>
      <h1>We couldn't find that page</h1>
      <p className="muted">The salon link may be wrong, or the salon has paused its try-on.</p>
      <Link className="btn btn-accent" href="/">Go home</Link>
    </main>
  );
}
