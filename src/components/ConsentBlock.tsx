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
import { LEGAL_DOCUMENTS } from '@/lib/content/legal';
import { ChevronDownIcon, BellIcon } from './icons';

function LegalReader({ slug }: { slug: 'terms' | 'privacy' }) {
  const [open, setOpen] = useState(false);
  const doc = LEGAL_DOCUMENTS[slug];

  return (
    <div style={{ marginTop: 6 }}>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ padding: '3px 7px', fontSize: 12.5, color: 'var(--accent)' }}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? 'Hide' : 'Read'} the {doc.title.toLowerCase()}
          <ChevronDownIcon
            size={12}
            style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 140ms' }}
          />
        </button>
        <Link
          href={`/legal/${slug}`}
          target="_blank"
          className="tiny subtle"
          style={{ textDecoration: 'underline' }}
        >
          Open in a new tab
        </Link>
      </div>

      {open && (
        <div
          style={{
            marginTop: 9,
            maxHeight: 300,
            overflowY: 'auto',
            padding: '14px 16px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-sunken)',
          }}
        >
          <div className="tiny subtle" style={{ marginBottom: 10 }}>
            Version {doc.version} · last updated {doc.updated}
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
      )}
    </div>
  );
}

export default function ConsentBlock({ error }: { error?: boolean }) {
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div>
        <div className="label" style={{ marginBottom: 8 }}>
          Before you create an account
        </div>

        <label className={`checkline ${error ? '' : 'checkline-required'}`} style={error ? { borderColor: 'var(--danger)' } : undefined}>
          <input type="checkbox" name="accept_terms" required />
          <span>
            <span style={{ fontWeight: 580, fontSize: 13.5 }}>
              I have read and accept the terms of service
            </span>
            <LegalReader slug="terms" />
          </span>
        </label>

        <label
          className={`checkline ${error ? '' : 'checkline-required'}`}
          style={{ marginTop: 8, ...(error ? { borderColor: 'var(--danger)' } : {}) }}
        >
          <input type="checkbox" name="accept_privacy" required />
          <span>
            <span style={{ fontWeight: 580, fontSize: 13.5 }}>
              I have read and accept the privacy policy
            </span>
            <LegalReader slug="privacy" />
          </span>
        </label>
      </div>

      <div>
        <div className="label" style={{ marginBottom: 4 }}>
          Notifications — all optional
        </div>
        <p className="hint" style={{ marginBottom: 8 }}>
          Leave every box below unticked and you lose nothing. Everything still arrives in the bell
          in the top-right corner of the app. These settings only decide whether a copy also reaches
          your inbox or your phone, and you can change them any time.
        </p>

        <div className="stack" style={{ gap: 7 }}>
          <label className="checkline">
            <input type="checkbox" name="consent_OPERATIONAL_EMAIL" />
            <span>
              <span style={{ fontWeight: 580, fontSize: 13.5 }}>E-mail me about my work</span>
              <span className="hint" style={{ display: 'block', marginTop: 2 }}>
                A task assigned to you, or a decision waiting on you.
              </span>
            </span>
          </label>

          <label className="checkline">
            <input type="checkbox" name="consent_OPERATIONAL_SMS" />
            <span>
              <span style={{ fontWeight: 580, fontSize: 13.5 }}>Text me about my work</span>
              <span className="hint" style={{ display: 'block', marginTop: 2 }}>
                The same messages, by SMS. Useful if you are not at a desk.
              </span>
            </span>
          </label>

          <label className="checkline">
            <input type="checkbox" name="consent_MARKETING_EMAIL" />
            <span>
              <span style={{ fontWeight: 580, fontSize: 13.5 }}>E-mail me product news</span>
              <span className="hint" style={{ display: 'block', marginTop: 2 }}>
                New features and changes to how distribution works.
              </span>
            </span>
          </label>

          <label className="checkline">
            <input type="checkbox" name="consent_MARKETING_SMS" />
            <span>
              <span style={{ fontWeight: 580, fontSize: 13.5 }}>Text me product news</span>
              <span className="hint" style={{ display: 'block', marginTop: 2 }}>
                Rare. Only for changes that affect how work reaches you.
              </span>
            </span>
          </label>
        </div>

        <div className="notice" style={{ marginTop: 10 }}>
          <BellIcon size={16} style={{ flex: 'none', marginTop: 1, color: 'var(--text-subtle)' }} />
          <span className="tiny muted">
            Said no to all of it? Then the bell is where new features and everything else will be.
            Nothing is hidden from you for declining.
          </span>
        </div>
      </div>
    </div>
  );
}
