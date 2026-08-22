'use client';

/**
 * Consent management.
 *
 * The framing on this page matters: each control says what turning it *off*
 * costs, which is nothing, because the bell is unconditional. That is the
 * honest description of the system, and it is also the one that makes it easy
 * for someone to say no.
 */

import { useActionState, useState } from 'react';
import {
  confirmPhoneLinkAction,
  reacceptTermsAction,
  startPhoneLinkAction,
  updateNotificationConsentAction,
  type PhoneLinkState,
} from '@/app/actions/settings';
import type { ActionState } from '@/app/actions/catalogue';
import { BellIcon, MailIcon, PhoneIcon, SparkIcon } from './icons';

const INITIAL: ActionState = { ok: false };
const INITIAL_PHONE: PhoneLinkState = { ok: false };

export function ConsentForm({
  values,
  hasEmail,
  hasPhone,
  emailVerified,
  phoneVerified,
}: {
  values: {
    OPERATIONAL_EMAIL: boolean;
    OPERATIONAL_SMS: boolean;
    MARKETING_EMAIL: boolean;
    MARKETING_SMS: boolean;
  };
  hasEmail: boolean;
  hasPhone: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
}) {
  const [state, action, pending] = useActionState(updateNotificationConsentAction, INITIAL);

  return (
    <form action={action} className="stack" style={{ gap: 14 }}>
      {state.error && <div className="notice notice-danger" role="alert">{state.error}</div>}
      {state.ok && state.message && <div className="notice notice-ok">{state.message}</div>}

      <div className="notice">
        <BellIcon size={17} style={{ flex: 'none', marginTop: 1, color: 'var(--text-subtle)' }} />
        <span className="tiny muted">
          These switches only decide where a copy goes. Every notification reaches you in the bell
          regardless — including product news, so turning everything off never means being kept in
          the dark.
        </span>
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 8 }}>
          <MailIcon size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
          About your work
        </legend>
        <div className="stack" style={{ gap: 7 }}>
          <ConsentSwitch
            name="consent_OPERATIONAL_EMAIL"
            checked={values.OPERATIONAL_EMAIL}
            disabled={!hasEmail}
            title="E-mail me when work lands on my desk"
            description={
              !hasEmail
                ? 'No e-mail address on this account.'
                : !emailVerified
                  ? 'Your e-mail address is not verified yet, so nothing will be sent until it is.'
                  : 'A task assigned to you, or a decision waiting on you.'
            }
          />
          <ConsentSwitch
            name="consent_OPERATIONAL_SMS"
            checked={values.OPERATIONAL_SMS}
            disabled={!hasPhone}
            title="Text me when work lands on my desk"
            description={
              !hasPhone
                ? 'No phone number on this account — add one below.'
                : !phoneVerified
                  ? 'Your number is not verified yet, so nothing will be sent until it is.'
                  : 'The same messages, by SMS.'
            }
          />
        </div>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 8 }}>
          <SparkIcon size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
          Product news
        </legend>
        <div className="stack" style={{ gap: 7 }}>
          <ConsentSwitch
            name="consent_MARKETING_EMAIL"
            checked={values.MARKETING_EMAIL}
            disabled={!hasEmail}
            title="E-mail me about new features"
            description="Changes to how distribution works, and what is new."
          />
          <ConsentSwitch
            name="consent_MARKETING_SMS"
            checked={values.MARKETING_SMS}
            disabled={!hasPhone}
            title="Text me about new features"
            description="Rare, and only for changes that affect how work reaches you."
          />
        </div>
      </fieldset>

      <button type="submit" className="btn btn-primary" disabled={pending} style={{ alignSelf: 'flex-start' }}>
        {pending ? <><span className="spin" /> Saving…</> : 'Save my choices'}
      </button>
    </form>
  );
}

function ConsentSwitch({
  name,
  checked,
  disabled,
  title,
  description,
}: {
  name: string;
  checked: boolean;
  disabled?: boolean;
  title: string;
  description: string;
}) {
  return (
    <label className="checkline" style={disabled ? { opacity: 0.6 } : undefined}>
      <input type="checkbox" name={name} defaultChecked={checked} disabled={disabled} />
      <span>
        <span style={{ fontWeight: 580, fontSize: 13.5 }}>{title}</span>
        <span className="hint" style={{ display: 'block', marginTop: 2 }}>{description}</span>
      </span>
    </label>
  );
}

export function ReacceptTermsForm() {
  const [state, action, pending] = useActionState(
    async () => reacceptTermsAction(),
    INITIAL,
  );

  return (
    <form action={action}>
      {state.ok && state.message && (
        <div className="notice notice-ok" style={{ marginBottom: 12 }}>{state.message}</div>
      )}
      <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? <><span className="spin" /> Recording…</> : 'I accept the current versions'}
      </button>
    </form>
  );
}

export function PhoneLinkForm() {
  const [startState, startAction, starting] = useActionState(startPhoneLinkAction, INITIAL_PHONE);
  const [confirmState, confirmAction, confirming] = useActionState(confirmPhoneLinkAction, INITIAL_PHONE);
  const [phone, setPhone] = useState('');

  if (confirmState.ok && confirmState.message) {
    return <div className="notice notice-ok">{confirmState.message}</div>;
  }

  if (startState.ok && startState.step === 'code') {
    return (
      <form action={confirmAction} className="stack" style={{ gap: 12 }}>
        <input type="hidden" name="phone" value={startState.phone ?? phone} />
        <div className="notice notice-ok">{startState.message}</div>
        {startState.devCode && (
          <div className="notice notice-warn">
            <span>
              <strong>Development mode.</strong> Nothing was sent. Your code is{' '}
              <span className="mono" style={{ fontWeight: 700 }}>{startState.devCode}</span>.
            </span>
          </div>
        )}
        {confirmState.error && <div className="notice notice-danger" role="alert">{confirmState.error}</div>}
        <div className="field">
          <label className="label" htmlFor="link-otp">Six-digit code</label>
          <input
            id="link-otp"
            name="code"
            className="input otp-input"
            inputMode="numeric"
            maxLength={6}
            pattern="\d{6}"
            required
            autoFocus
            placeholder="000000"
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={confirming}>
          {confirming ? <><span className="spin" /> Checking…</> : 'Verify this number'}
        </button>
      </form>
    );
  }

  return (
    <form action={startAction} className="stack" style={{ gap: 12 }}>
      {startState.error && <div className="notice notice-danger" role="alert">{startState.error}</div>}
      <div className="field">
        <label className="label" htmlFor="link-phone">
          <PhoneIcon size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
          Phone number
        </label>
        <input
          id="link-phone"
          name="phone"
          type="tel"
          className="input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          placeholder="+45 20 12 34 56"
        />
        <span className="hint">
          Verifying a number lets you sign in with it, and makes SMS notifications possible.
        </span>
      </div>
      <button type="submit" className="btn" disabled={starting}>
        {starting ? <><span className="spin" /> Sending…</> : 'Send a verification code'}
      </button>
    </form>
  );
}
