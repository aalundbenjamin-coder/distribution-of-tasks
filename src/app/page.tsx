import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { LogoMark } from '@/components/TopBar';
import {
  ArrowRightIcon,
  BellIcon,
  FolderIcon,
  PeopleIcon,
  ScaleIcon,
  ShieldIcon,
  SparkIcon,
} from '@/components/icons';

export default async function LandingPage() {
  if (await getCurrentUser()) redirect('/dashboard');
  const { locale, t } = await getTranslations();

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
        <div className="shell row" style={{ height: 60, gap: 9 }}>
          <Link href="/" className="row" style={{ gap: 9 }}>
            <LogoMark size={28} />
            <span style={{ fontWeight: 680, letterSpacing: '-0.02em', fontSize: 16 }}>
              {t.meta.appName}
            </span>
          </Link>
          <div style={{ flex: 1 }} />
          <LanguageSwitcher current={locale} compact />
          <Link href="/login" className="btn btn-sm btn-ghost">{t.landing.ctaSignIn}</Link>
          <Link href="/signup" className="btn btn-sm btn-primary">{t.landing.ctaCreate}</Link>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        {/* Hero ------------------------------------------------------------ */}
        <section className="shell" style={{ padding: '76px 24px 56px', textAlign: 'center' }}>
          <div className="badge badge-accent" style={{ marginBottom: 18 }}>
            <SparkIcon size={13} /> {t.landing.badge}
          </div>
          <h1
            style={{
              fontSize: 'clamp(32px, 5.2vw, 52px)',
              fontWeight: 680,
              letterSpacing: '-0.035em',
              lineHeight: 1.08,
              maxWidth: '18ch',
              margin: '0 auto',
            }}
          >
            {t.landing.heroTitle}
          </h1>
          <p
            className="page-lede"
            style={{ margin: '20px auto 0', fontSize: 17, maxWidth: '58ch', textAlign: 'center' }}
          >
            {t.landing.heroBody}
          </p>

          <div className="row" style={{ gap: 12, justifyContent: 'center', marginTop: 30, flexWrap: 'wrap' }}>
            <Link href="/signup" className="btn btn-primary btn-lg">
              {t.landing.ctaCreate} <ArrowRightIcon size={16} />
            </Link>
            <Link href="/login" className="btn btn-lg">{t.landing.ctaSignIn}</Link>
          </div>
          <p className="tiny subtle" style={{ marginTop: 14 }}>
            {t.landing.ctaNote}
          </p>
        </section>

        {/* The flow -------------------------------------------------------- */}
        <section className="shell" style={{ padding: '10px 24px 60px' }}>
          <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <Step
              n="1"
              icon={<FolderIcon size={19} />}
              stepWord={t.landing.step}
              title={t.landing.step1Title}
              body={t.landing.step1Body}
            />
            <Step
              n="2"
              icon={<ShieldIcon size={19} />}
              stepWord={t.landing.step}
              title={t.landing.step2Title}
              body={t.landing.step2Body}
            />
            <Step
              n="3"
              icon={<ScaleIcon size={19} />}
              stepWord={t.landing.step}
              title={t.landing.step3Title}
              body={t.landing.step3Body}
            />
            <Step
              n="4"
              icon={<PeopleIcon size={19} />}
              stepWord={t.landing.step}
              title={t.landing.step4Title}
              body={t.landing.step4Body}
            />
          </div>
        </section>

        {/* Precision ------------------------------------------------------- */}
        <section style={{ background: 'var(--bg-raised)', borderBlock: '1px solid var(--border)' }}>
          <div className="shell" style={{ padding: '56px 24px' }}>
            <div style={{ maxWidth: '62ch' }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>{t.landing.tieEyebrow}</div>
              <h2 style={{ fontSize: 26, letterSpacing: '-0.025em' }}>
                {t.landing.tieTitle}
              </h2>
              <p className="page-lede" style={{ marginTop: 12 }}>
                {t.landing.tieBody}
              </p>
            </div>

            <div className="grid-auto" style={{ marginTop: 28 }}>
              <Point
                title={t.landing.point1Title}
                body={t.landing.point1Body}
              />
              <Point
                title={t.landing.point2Title}
                body={t.landing.point2Body}
              />
              <Point
                title={t.landing.point3Title}
                body={t.landing.point3Body}
              />
              <Point
                title={t.landing.point4Title}
                body={t.landing.point4Body}
              />
            </div>
          </div>
        </section>

        {/* Notifications --------------------------------------------------- */}
        <section className="shell" style={{ padding: '56px 24px 70px' }}>
          <div
            style={{
              display: 'grid',
              gap: 30,
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              alignItems: 'start',
            }}
          >
            <div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>{t.landing.notifyEyebrow}</div>
              <h2 style={{ fontSize: 24, letterSpacing: '-0.025em' }}>
                {t.landing.notifyTitle}
              </h2>
              <p className="page-lede" style={{ marginTop: 12 }}>
                {t.landing.notifyBody1}
              </p>
              <p className="page-lede" style={{ marginTop: 10 }}>
                {t.landing.notifyBody2}
              </p>
            </div>

            <div className="card card-pad">
              <div className="row" style={{ gap: 10, marginBottom: 14 }}>
                <span style={{ position: 'relative', color: 'var(--text-muted)' }}>
                  <BellIcon size={22} />
                  <span
                    className="bell-count"
                    style={{ top: -4, right: -6, borderColor: 'var(--bg-raised)' }}
                  >
                    3
                  </span>
                </span>
                <strong style={{ fontSize: 14 }}>{t.landing.bellTitle}</strong>
              </div>
              <ul className="stack" style={{ gap: 10, margin: 0, padding: 0, listStyle: 'none' }}>
                {[
                  [t.landing.bell1, t.landing.bell1Body],
                  [t.landing.bell2, t.landing.bell2Body],
                  [t.landing.bell3, t.landing.bell3Body],
                ].map(([title, body]) => (
                  <li key={title} style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 11 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{title}</div>
                    <div className="tiny muted">{body}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '22px 0' }}>
        <div className="shell row" style={{ gap: 18, flexWrap: 'wrap' }}>
          <span className="tiny subtle">{t.meta.appName}</span>
          <div style={{ flex: 1 }} />
          <Link href="/legal/terms" className="tiny subtle">{t.consent.TERMS_OF_SERVICE}</Link>
          <Link href="/legal/privacy" className="tiny subtle">{t.consent.PRIVACY_POLICY}</Link>
        </div>
      </footer>
    </div>
  );
}

function Step({
  n,
  icon,
  title,
  body,
  stepWord,
}: {
  n: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  stepWord: string;
}) {
  return (
    <div className="card card-pad">
      <div className="row" style={{ gap: 10, marginBottom: 10 }}>
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            display: 'grid',
            placeItems: 'center',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            border: '1px solid var(--accent-border)',
            flex: 'none',
          }}
        >
          {icon}
        </span>
        <span className="eyebrow">{stepWord} {n}</span>
      </div>
      <h3 style={{ fontSize: 15, marginBottom: 6 }}>{title}</h3>
      <p className="small muted">{body}</p>
    </div>
  );
}

function Point({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 style={{ fontSize: 14.5, marginBottom: 5 }}>{title}</h3>
      <p className="small muted">{body}</p>
    </div>
  );
}
