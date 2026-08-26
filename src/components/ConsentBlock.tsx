'use client';

/**
 * The consent block on the sign-up form.
 *
 * Two things are deliberate here:
 *
 *  * The terms of service and the privacy policy can be *read on the spot*.
 *    Each opens inline, in full, without leaving the form and losing what has
 *    already been typed. A link to the standalone page sits alongside for
 *    anyone who wants it in its own tab.
 *
 *  * Marketing and notification permissions are separate, unticked, and
 *    described in terms of what actually happens if you leave them off — which
 *    is that everything still reaches you in the bell.
 */

import { useState } from 'react';
import Link from 'next/link';
import { legalDocuments } from '@/lib/content/legal';
import { ChevronDownIcon, BellIcon } from './icons';
import type { Dictionary } from '@/lib/i18n/dictionary';
import type { Locale } from '@/lib/i18n/locale';

/**
 * One reader for both documents.
 *
 * The previous version put each document in its own box with its own
 * "read"/"open" pair, which read as clutter on a sign-up form. There is one
 * decision to make here, so there is one box — the documents are still
 * available in full, behind a single control, with a tab to move between them.
 */
function LegalReader({ t, locale }: { t: Dictionary; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<'terms' | 'privacy'>('terms');
  const docs = legalDocuments(locale);
  const doc = docs[shown];

  return (
    <div style={{ marginTop: 8 }}>
      <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ padding: '3px 7px', fontSize: 12.5, color: 'var(--accent)' }}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? t.consentForm.hideThem : t.consentForm.readThem}
          <ChevronDownIcon
            size={12}
            style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 140ms' }}
          />
        </button>
        <Link href="/legal/terms" target="_blank" className="tiny subtle" style={{ textDecoration: 'underline' }}>
          {docs.terms.title}
        </Link>
        <Link href="/legal/privacy" target="_blank" className="tiny subtle" style={{ textDecoration: 'underline' }}>
          {docs.privacy.title}
        </Link>
      </div>

      {open && (
        <div
          style={{
            marginTop: 10,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-sunken)',
            overflow: 'hidden',
          }}
        >
          <div
            className="row"
            style={{ gap: 4, padding: 8, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}
          >
            {(['terms', 'privacy'] as const).map((slug) => (
              <button
                key={slug}
                type="button"
                className="btn btn-sm"
                data-active={shown === slug}
                onClick={() => setShown(slug)}
                style={{
                  padding: '4px 10px',
                  fontSize: 12.5,
                  background: shown === slug ? 'var(--bg-raised)' : 'transparent',
                  borderColor: shown === slug ? 'var(--border-strong)' : 'transparent',
                }}
              >
                {docs[slug].title}
              </button>
            ))}
          </div>

          <div style={{ maxHeight: 280, overflowY: 'auto', padding: '14px 16px' }}>
            <div className="tiny subtle" style={{ marginBottom: 10 }}>
              {t.consentForm.version} {doc.version} · {t.consentForm.lastUpdated} {doc.updated}
            </div>
            {doc.sections.map((section) => (
              <div key={section.heading} style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 640, fontSize: 13, marginBottom: 4 }}>{section.heading}</div>
                {section.paragraphs.map((text, i) => (
                  <p key={i} className="tiny muted" style={{ marginBottom: 6, lineHeight: 1.55 }}>
                    {text}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConsentBlock({
  error,
  t,
  locale,
}: {
  error?: boolean;
  t: Dictionary;
  locale: Locale;
}) {
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div>
        <div className="label" style={{ marginBottom: 8 }}>
          {t.consentForm.beforeYouCreate}
        </div>

        <label
          className={`checkline ${error ? '' : 'checkline-required'}`}
          style={error ? { borderColor: 'var(--danger)' } : undefined}
        >
          <input type="checkbox" name="accept_documents" required />
          <span>
            <span style={{ fontWeight: 580, fontSize: 13.5 }}>{t.consentForm.acceptBoth}</span>
            <LegalReader t={t} locale={locale} />
          </span>
        </label>
      </div>

      <div>
        <div className="label" style={{ marginBottom: 4 }}>
          {t.consentForm.notificationsTitle}
        </div>
        <p className="hint" style={{ marginBottom: 8 }}>
          {t.consentForm.notificationsBody}
        </p>

        <div className="stack" style={{ gap: 7 }}>
          <label className="checkline">
            <input type="checkbox" name="consent_OPERATIONAL_EMAIL" />
            <span>
              <span style={{ fontWeight: 580, fontSize: 13.5 }}>{t.consentForm.emailWork}</span>
              <span className="hint" style={{ display: 'block', marginTop: 2 }}>
                {t.consentForm.emailWorkBody}
              </span>
            </span>
          </label>

          <label className="checkline">
            <input type="checkbox" name="consent_OPERATIONAL_SMS" />
            <span>
              <span style={{ fontWeight: 580, fontSize: 13.5 }}>{t.consentForm.smsWork}</span>
              <span className="hint" style={{ display: 'block', marginTop: 2 }}>
                {t.consentForm.smsWorkBody}
              </span>
            </span>
          </label>

          <label className="checkline">
            <input type="checkbox" name="consent_MARKETING_EMAIL" />
            <span>
              <span style={{ fontWeight: 580, fontSize: 13.5 }}>{t.consentForm.emailNews}</span>
              <span className="hint" style={{ display: 'block', marginTop: 2 }}>
                {t.consentForm.emailNewsBody}
              </span>
            </span>
          </label>

          <label className="checkline">
            <input type="checkbox" name="consent_MARKETING_SMS" />
            <span>
              <span style={{ fontWeight: 580, fontSize: 13.5 }}>{t.consentForm.smsNews}</span>
              <span className="hint" style={{ display: 'block', marginTop: 2 }}>
                {t.consentForm.smsNewsBody}
              </span>
            </span>
          </label>
        </div>

        <div className="notice" style={{ marginTop: 10 }}>
          <BellIcon size={16} style={{ flex: 'none', marginTop: 1, color: 'var(--text-subtle)' }} />
          <span className="tiny muted">
            {t.consentForm.bellFallback}
          </span>
        </div>
      </div>
    </div>
  );
}
