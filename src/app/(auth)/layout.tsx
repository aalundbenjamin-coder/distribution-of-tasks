import Link from 'next/link';
import { LogoMark } from '@/components/TopBar';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
        <div className="shell row" style={{ height: 58, gap: 9 }}>
          <Link href="/" className="row" style={{ gap: 9 }}>
            <LogoMark />
            <span style={{ fontWeight: 680, letterSpacing: '-0.02em', fontSize: 15 }}>
              Distribution<span className="subtle" style={{ fontWeight: 500 }}> of Tasks</span>
            </span>
          </Link>
        </div>
      </header>

      <main style={{ flex: 1, padding: '40px 0 64px' }}>{children}</main>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '18px 0' }}>
        <div className="shell row" style={{ gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/legal/terms" className="tiny subtle">Terms of service</Link>
          <Link href="/legal/privacy" className="tiny subtle">Privacy policy</Link>
          <Link href="/" className="tiny subtle">About the system</Link>
        </div>
      </footer>
    </div>
  );
}
