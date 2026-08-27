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
import type { Dictionary } from '@/lib/i18n/dictionary';

const INITIAL: ActionState = { ok: false };
const INITIAL_PHONE: PhoneLinkState = { ok: false };

export function ConsentForm({
  values,
  hasEmail,
  hasPhone,
  emailVerified,
  phoneVerified,
  t,
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
  t: Dictionary;
}) {
  const [state, action, pending] = useActionState(updateNotificationConsentAction, INITIAL);

  return (
    <form action={action} className="stack" style={{ gap: 14 }}>
      {state.error && <div className="notice notice-danger" role="alert">{state.error}</div>}
      {state.ok && state.message && <div className="notice notice-ok">{state.message}</div>}

      <div className="notice">
        <BellIcon size={17} style={{ flex: 'none', marginTop: 1, color: 'var(--text-subtle)' }} />
        <span className="tiny muted">
          {t.settings.bellNote}
        </span>
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 8 }}>
          <MailIcon size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
          {t.settings.aboutYourWork}
        </legend>
        <div className="stack" style={{ gap: 7 }}>
          <ConsentSwitch
            name="consent_OPERATIONAL_EMAIL"
            checked={values.OPERATIONAL_EMAIL}
            disabled={!hasEmail}
            title={t.settings.emailWhenWork}
            description={
              !hasEmail
                ? t.settings.noEmailOnAccount
                : !emailVerified
                  ? t.settings.emailUnverified
                  : t.settings.workDescription
            }
          />
          <ConsentSwitch
            name="consent_OPERATIONAL_SMS"
            checked={values.OPERATIONAL_SMS}
            disabled={!hasPhone}
            title={t.settings.smsWhenWork}
            description={
              !hasPhone
                ? <NoPhoneYet t={t} />
                : !phoneVerified
                  ? t.settings.phoneUnverified
                  : t.settings.sameBySms
            }
          />
        </div>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 8 }}>
          <SparkIcon size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
          {t.settings.productNewsGroup}
        </legend>
        <div className="stack" style={{ gap: 7 }}>
          <ConsentSwitch
            name="consent_MARKETING_EMAIL"
            checked={values.MARKETING_EMAIL}
            disabled={!hasEmail}
            title={t.settings.emailFeatures}
            description={t.settings.featuresDescription}
          />
          <ConsentSwitch
            name="consent_MARKETING_SMS"
            checked={values.MARKETING_SMS}
            disabled={!hasPhone}
            title={t.settings.smsFeatures}
            description={!hasPhone ? <NoPhoneYet t={t} /> : t.settings.featuresSmsDescription}
          />
        </div>
      </fieldset>

      <button type="submit" className="btn btn-primary" disabled={pending} style={{ alignSelf: 'flex-start' }}>
        {pending ? <><span className="spin" /> {t.common.saving}</> : t.settings.saveChoices}
      </button>
    </form>
  );
}

/** The disabled state names its cure and links straight to it. */
function NoPhoneYet({ t }: { t: Dictionary }) {
  return (
    <>
      {t.settings.noPhoneOnAccount}{' '}
      <a href="#link-phone" style={{ color: 'var(--accent)', fontWeight: 560 }}>
        {t.settings.addPhoneLink}
      </a>
    </>
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
  description: React.ReactNode;
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

export function ReacceptTermsForm({ labels }: { labels: { accept: string; recording: string } }) {
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
        {pending ? <><span className="spin" /> {labels.recording}</> : labels.accept}
      </button>
    </form>
  );
}

export function PhoneLinkForm({
  labels,
}: {
  labels: {
    phoneNumber: string; hint: string; send: string; sending: string;
    code: string; verify: string; checking: string; devMode: string; devBody: string;
  };
}) {
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
              <strong>{labels.devMode}</strong> {labels.devBody}{' '}
              <span className="mono" style={{ fontWeight: 700 }}>{startState.devCode}</span>.
            </span>
          </div>
        )}
        {confirmState.error && <div className="notice notice-danger" role="alert">{confirmState.error}</div>}
        <div className="field">
          <label className="label" htmlFor="link-otp">{labels.code}</label>
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
          {confirming ? <><span className="spin" /> {labels.checking}</> : labels.verify}
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
          {labels.phoneNumber}
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
          {labels.hint}
        </span>
      </div>
      <button type="submit" className="btn" disabled={starting}>
        {starting ? <><span className="spin" /> {labels.sending}</> : labels.send}
      </button>
    </form>
  );
}
