'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { GoogleIcon, MailIcon, PhoneIcon } from './icons';
import {
  requestPhoneCodeAction,
  signInEmailAction,
  verifyPhoneCodeAction,
  type FormState,
} from '@/app/actions/auth';
import type { Dictionary } from '@/lib/i18n/dictionary';

type Method = 'email' | 'google' | 'phone';
const INITIAL: FormState = { ok: false };

function Problem({ state }: { state: FormState }) {
  if (state.ok || !state.error) return null;
  return (
    <div className="notice notice-danger" role="alert">
      {state.error}
    </div>
  );
}

export default function SignInForm({ next, t }: { next: string; t: Dictionary }) {
  const [method, setMethod] = useState<Method>('email');

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="segmented" role="tablist" aria-label={t.auth.howToSignIn}>
        <button type="button" role="tab" aria-selected={method === 'email'} data-active={method === 'email'} onClick={() => setMethod('email')}>
          <MailIcon size={14} style={{ verticalAlign: -2, marginRight: 6 }} /> {t.auth.methodEmail}
        </button>
        <button type="button" role="tab" aria-selected={method === 'google'} data-active={method === 'google'} onClick={() => setMethod('google')}>
          <GoogleIcon size={14} style={{ verticalAlign: -2, marginRight: 6 }} /> {t.auth.methodGoogle}
        </button>
        <button type="button" role="tab" aria-selected={method === 'phone'} data-active={method === 'phone'} onClick={() => setMethod('phone')}>
          <PhoneIcon size={14} style={{ verticalAlign: -2, marginRight: 6 }} /> {t.auth.methodPhone}
        </button>
      </div>

      {method === 'email' && <EmailSignIn next={next} t={t} />}
      {method === 'google' && <GoogleSignIn next={next} t={t} />}
      {method === 'phone' && <PhoneSignIn next={next} t={t} />}

      <p className="small muted" style={{ textAlign: 'center' }}>
        {t.auth.noAccountYet}{' '}
        <Link href="/signup" style={{ color: 'var(--accent)', fontWeight: 560 }}>
          {t.auth.createOne}
        </Link>
      </p>
    </div>
  );
}

function EmailSignIn({ next, t }: { next: string; t: Dictionary }) {
  const [state, action, pending] = useActionState(signInEmailAction, INITIAL);
  return (
    <form action={action} className="stack" style={{ gap: 15 }}>
      <input type="hidden" name="next" value={next} />
      <Problem state={state} />
      <div className="field">
        <label className="label" htmlFor="in-email">{t.auth.email}</label>
        <input id="in-email" name="email" type="email" className="input" autoComplete="email" required autoFocus />
      </div>
      <div className="field">
        <label className="label" htmlFor="in-password">{t.auth.password}</label>
        <input id="in-password" name="password" type="password" className="input" autoComplete="current-password" required />
      </div>
      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={pending}>
        {pending ? <><span className="spin" /> {t.common.loading}</> : t.common.signIn}
      </button>
    </form>
  );
}

function GoogleSignIn({ next, t }: { next: string; t: Dictionary }) {
  return (
    <form action="/api/auth/google/start" method="post" className="stack" style={{ gap: 14 }}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="mode" value="login" />
      <p className="small muted">
        {t.auth.googleSignInNote}
      </p>
      <button type="submit" className="btn btn-lg btn-block">
        <GoogleIcon size={17} /> {t.auth.continueWithGoogle}
      </button>
    </form>
  );
}

function PhoneSignIn({ next, t }: { next: string; t: Dictionary }) {
  const [requestState, requestAction, requesting] = useActionState(requestPhoneCodeAction, INITIAL);
  const [verifyState, verifyAction, verifying] = useActionState(verifyPhoneCodeAction, INITIAL);
  const [phone, setPhone] = useState('');

  if (requestState.ok && requestState.step === 'code') {
    return (
      <form action={verifyAction} className="stack" style={{ gap: 15 }}>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="phone" value={phone} />
        <div className="notice notice-ok">{requestState.message}</div>
        {requestState.devCode && (
          <div className="notice notice-warn">
            <span>
              <strong>{t.auth.devMode}</strong> {t.auth.devModeBody}{' '}
              <span className="mono" style={{ fontWeight: 700 }}>{requestState.devCode}</span>.
            </span>
          </div>
        )}
        <Problem state={verifyState} />
        <div className="field">
          <label className="label" htmlFor="in-otp">{t.auth.codeLabel}</label>
          <input
            id="in-otp"
            name="code"
            className="input otp-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="\d{6}"
            required
            autoFocus
            placeholder="000000"
          />
        </div>
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={verifying}>
          {verifying ? <><span className="spin" /> {t.common.checking}</> : t.common.signIn}
        </button>
      </form>
    );
  }

  return (
    <form action={requestAction} className="stack" style={{ gap: 15 }}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="mode" value="login" />
      <Problem state={requestState} />
      <div className="field">
        <label className="label" htmlFor="in-phone">{t.auth.mobile}</label>
        <input
          id="in-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          className="input"
          autoComplete="tel"
          required
          autoFocus
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+45 20 12 34 56"
        />
      </div>
      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={requesting}>
        {requesting ? <><span className="spin" /> {t.common.sending}</> : t.auth.sendCode}
      </button>
    </form>
  );
}
