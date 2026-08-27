'use client';

/**
 * Sign-up, with the three doors the product promises: an e-mail address and a
 * password, a Google account, or a phone number.
 *
 * The consent block is shared across all three, and consent is always collected
 * *before* an account exists — including for Google, where the decisions are
 * stashed server-side and applied when the callback returns.
 */

import { useActionState, useState } from 'react';
import Link from 'next/link';
import ConsentBlock from './ConsentBlock';
import { GoogleIcon, MailIcon, PhoneIcon } from './icons';
import {
  requestPhoneCodeAction,
  signUpEmailAction,
  verifyPhoneCodeAction,
  type FormState,
} from '@/app/actions/auth';
import type { Dictionary } from '@/lib/i18n/dictionary';
import { signInErrorMessage } from '@/lib/auth/sign-in-errors';
import type { Locale } from '@/lib/i18n/locale';

type Method = 'email' | 'google' | 'phone';

const INITIAL: FormState = { ok: false };

function FieldError({ state, field }: { state: FormState; field: string }) {
  if (state.ok || state.field !== field || !state.error) return null;
  return <span className="field-error">{state.error}</span>;
}

function GeneralError({ state }: { state: FormState }) {
  if (state.ok || !state.error) return null;
  if (state.field && state.field !== 'consent') return null;
  return (
    <div className="notice notice-danger" role="alert">
      {state.error}
    </div>
  );
}

export default function SignUpForm({
  initialMethod = 'email',
  initialError,
  next,
  googleConfigured,
  t,
  locale,
}: {
  initialMethod?: Method;
  initialError?: string;
  next: string;
  googleConfigured: boolean;
  t: Dictionary;
  locale: Locale;
}) {
  const [method, setMethod] = useState<Method>(initialMethod);

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="segmented" role="tablist" >
        <button type="button" role="tab" aria-selected={method === 'email'} data-active={method === 'email'} onClick={() => setMethod('email')}>
          <MailIcon size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
          {t.auth.methodEmail}
        </button>
        <button type="button" role="tab" aria-selected={method === 'google'} data-active={method === 'google'} onClick={() => setMethod('google')}>
          <GoogleIcon size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
          {t.auth.methodGoogle}
        </button>
        <button type="button" role="tab" aria-selected={method === 'phone'} data-active={method === 'phone'} onClick={() => setMethod('phone')}>
          <PhoneIcon size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
          {t.auth.methodPhone}
        </button>
      </div>

      {initialError && (
        <div className="notice notice-danger" role="alert">
          {signInErrorMessage(t, initialError)}
        </div>
      )}

      {method === 'email' && <EmailSignUp next={next} t={t} locale={locale} />}
      {method === 'google' && <GoogleSignUp next={next} configured={googleConfigured} t={t} locale={locale} />}
      {method === 'phone' && <PhoneSignUp next={next} t={t} locale={locale} />}

      <p className="small muted" style={{ textAlign: 'center' }}>
        {t.auth.alreadyHave}{' '}
        <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 560 }}>{t.auth.signInTitle}</Link>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function EmailSignUp({ next, t, locale }: { next: string; t: Dictionary; locale: Locale }) {
  const [state, action, pending] = useActionState(signUpEmailAction, INITIAL);

  return (
    <form action={action} className="stack" style={{ gap: 15 }}>
      <input type="hidden" name="next" value={next} />
      <GeneralError state={state} />

      <div className="field">
        <label className="label" htmlFor="su-name">{t.auth.fullName}</label>
        <input
          id="su-name"
          name="fullName"
          className={`input ${state.field === 'fullName' ? 'input-error' : ''}`}
          autoComplete="name"
          required
          placeholder="Anna Holm"
        />
        <FieldError state={state} field="fullName" />
      </div>

      <div className="field">
        <label className="label" htmlFor="su-email">{t.auth.workEmail}</label>
        <input
          id="su-email"
          name="email"
          type="email"
          inputMode="email"
          className={`input ${state.field === 'email' ? 'input-error' : ''}`}
          autoComplete="email"
          required
          placeholder="anna.holm@company.com"
        />
        <FieldError state={state} field="email" />
      </div>

      <div className="field">
        <label className="label" htmlFor="su-password">{t.auth.password}</label>
        <input
          id="su-password"
          name="password"
          type="password"
          className={`input ${state.field === 'password' ? 'input-error' : ''}`}
          autoComplete="new-password"
          required
          minLength={10}
          placeholder={t.auth.passwordPlaceholder}
        />
        <span className="hint">
          {t.auth.passwordHint}
        </span>
        <FieldError state={state} field="password" />
      </div>

      <ConsentBlock error={state.field === 'consent'} t={t} locale={locale} />

      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={pending}>
        {pending ? <><span className="spin" /> {t.auth.creatingAccount}</> : t.auth.createAccount}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------

function GoogleSignUp({ next, configured, t, locale }: { next: string; configured: boolean; t: Dictionary; locale: Locale }) {
  return (
    <form action="/api/auth/google/start" method="post" className="stack" style={{ gap: 15 }}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="mode" value="signup" />

      {!configured && (
        <div className="notice notice-info">
          <span>
            <strong>{t.auth.googleUnconfigured}</strong> {t.auth.googleUnconfiguredBody}
          </span>
        </div>
      )}

      <p className="small muted">
        {t.auth.googleScopeNote}
      </p>

      <ConsentBlock t={t} locale={locale} />

      <button type="submit" className="btn btn-lg btn-block">
        <GoogleIcon size={17} />
        {t.auth.continueWithGoogle}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------

function PhoneSignUp({ next, t, locale }: { next: string; t: Dictionary; locale: Locale }) {
  const [requestState, requestAction, requesting] = useActionState(requestPhoneCodeAction, INITIAL);
  const [verifyState, verifyAction, verifying] = useActionState(verifyPhoneCodeAction, INITIAL);
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [consentSnapshot, setConsentSnapshot] = useState<Record<string, string>>({});

  const atCodeStep = requestState.ok && requestState.step === 'code';

  // The consent decisions are captured on the first step, when the code is
  // requested. They are carried forward as hidden fields so the account created
  // at the second step is created with exactly what the person agreed to.
  function captureConsents(form: HTMLFormElement) {
    const data = new FormData(form);
    const snapshot: Record<string, string> = {};
    for (const key of [
      'accept_documents',
      'consent_OPERATIONAL_EMAIL',
      'consent_OPERATIONAL_SMS',
      'consent_MARKETING_EMAIL',
      'consent_MARKETING_SMS',
    ]) {
      if (data.get(key) === 'on') snapshot[key] = 'on';
    }
    setConsentSnapshot(snapshot);
  }

  if (atCodeStep) {
    return (
      <form action={verifyAction} className="stack" style={{ gap: 15 }}>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="fullName" value={fullName} />
        {Object.entries(consentSnapshot).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}

        <div className="notice notice-ok">{requestState.message}</div>

        {requestState.devCode && (
          <div className="notice notice-warn">
            <span>
              <strong>{t.auth.devMode}</strong> {t.auth.devModeBody}{' '}
              <span className="mono" style={{ fontWeight: 700 }}>{requestState.devCode}</span>.
            </span>
          </div>
        )}

        <GeneralError state={verifyState} />

        <div className="field">
          <label className="label" htmlFor="otp">{t.auth.codeLabel}</label>
          <input
            id="otp"
            name="code"
            className={`input otp-input ${verifyState.field === 'code' ? 'input-error' : ''}`}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="\d{6}"
            required
            autoFocus
            placeholder="000000"
          />
          <FieldError state={verifyState} field="code" />
          <span className="hint">{t.auth.codeHint}</span>
        </div>

        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={verifying}>
          {verifying ? <><span className="spin" /> {t.common.checking}</> : t.auth.confirmCreate}
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => window.location.reload()}
        >
          {t.auth.useDifferentNumber}
        </button>
      </form>
    );
  }

  return (
    <form
      action={requestAction}
      className="stack"
      style={{ gap: 15 }}
      onSubmit={(event) => captureConsents(event.currentTarget)}
    >
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="mode" value="signup" />
      <GeneralError state={requestState} />

      <div className="field">
        <label className="label" htmlFor="ph-name">{t.auth.fullName}</label>
        <input
          id="ph-name"
          name="fullName"
          className={`input ${requestState.field === 'fullName' ? 'input-error' : ''}`}
          autoComplete="name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Anna Holm"
        />
        <FieldError state={requestState} field="fullName" />
      </div>

      <div className="field">
        <label className="label" htmlFor="ph-phone">{t.auth.mobile}</label>
        <input
          id="ph-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          className={`input ${requestState.field === 'phone' ? 'input-error' : ''}`}
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+45 20 12 34 56"
        />
        <span className="hint">
          {t.auth.mobileHint}
        </span>
        <FieldError state={requestState} field="phone" />
      </div>

      <ConsentBlock error={requestState.field === 'consent'} t={t} locale={locale} />

      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={requesting}>
        {requesting ? <><span className="spin" /> {t.common.sending}</> : t.auth.sendCode}
      </button>
    </form>
  );
}
