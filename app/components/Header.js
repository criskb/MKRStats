import Link from 'next/link';

export default function Header({ title, subtitle, current = 'dashboard' }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <nav className="top-nav">
        <Link href="/" aria-current={current === 'dashboard' ? 'page' : undefined}>Dashboard</Link>
        <Link href="/our-stats" aria-current={current === 'our-stats' ? 'page' : undefined}>Our Stats</Link>
        <Link href="/profile" aria-current={current === 'profile' ? 'page' : undefined}>Settings / Profile</Link>
      </nav>
    </header>
  );
}
