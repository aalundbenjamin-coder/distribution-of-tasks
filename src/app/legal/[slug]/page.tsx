import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LEGAL_DOCUMENTS } from '@/lib/content/legal';
import { LogoMark } from '@/components/TopBar';

export function generateStaticParams() {
  return [{ slug: 'terms' }, { slug: 'privacy' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = LEGAL_DOCUMENTS[slug as 'terms' | 'privacy'];
  return { title: doc?.title ?? 'Legal' };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = LEGAL_DOCUMENTS[slug as 'terms' | 'privacy'];
  if (!doc) notFound();

  const other = doc.slug === 'terms' ? LEGAL_DOCUMENTS.privacy : LEGAL_DOCUMENTS.terms;

  return (
    <div style={{ minHeight: '100dvh' }}>
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

      <main className="shell-narrow" style={{ padding: '40px 24px 80px' }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Version {doc.version} · updated {doc.updated}
        </div>
        <h1 className="page-title" style={{ fontSize: 30 }}>{doc.title}</h1>
        <p className="page-lede">{doc.summary}</p>

        <div className="card card-pad" style={{ marginTop: 26 }}>
          {doc.sections.map((section, index) => (
            <section key={section.heading} style={{ marginBottom: index === doc.sections.length - 1 ? 0 : 26 }}>
              <h2 style={{ fontSize: 16, marginBottom: 8 }}>{section.heading}</h2>
              {section.paragraphs.map((text, i) => (
                <p key={i} className="muted" style={{ marginBottom: 10, fontSize: 14.5 }}>
                  {text}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="row" style={{ gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
          <Link href={`/legal/${other.slug}`} className="btn btn-sm">
            Read the {other.title.toLowerCase()}
          </Link>
          <Link href="/signup" className="btn btn-sm btn-primary">
            Create an account
          </Link>
        </div>
      </main>
    </div>
  );
}
