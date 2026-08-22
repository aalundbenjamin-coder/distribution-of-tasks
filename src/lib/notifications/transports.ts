/**
 * Outbound e-mail and SMS.
 *
 * Both channels are behind a small interface with two implementations:
 *
 *   * a real provider (Resend for e-mail, Twilio for SMS), used when the
 *     matching environment variables are set;
 *   * a local transport that records the message instead of sending it, used
 *     when they are not.
 *
 * The local transport is what makes the whole sign-up and notification journey
 * walkable without buying anything. It is loud about what it is: every result
 * says which transport handled the message, and the UI labels simulated
 * deliveries as simulated rather than pretending they went out.
 */

export type TransportKind = 'RESEND' | 'TWILIO' | 'LOCAL';

export interface DeliveryResult {
  ok: boolean;
  transport: TransportKind;
  /** Provider message id, when there is one. */
  reference?: string;
  error?: string;
  /**
   * For the local transport: the text that would have been sent. Surfaced in
   * development so a one-time code can be read without an SMS gateway.
   */
  preview?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SmsMessage {
  to: string;
  text: string;
}

export function emailTransportKind(): TransportKind {
  return process.env.RESEND_API_KEY?.trim() ? 'RESEND' : 'LOCAL';
}

export function smsTransportKind(): TransportKind {
  const configured =
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
    process.env.TWILIO_AUTH_TOKEN?.trim() &&
    process.env.TWILIO_FROM_NUMBER?.trim();
  return configured ? 'TWILIO' : 'LOCAL';
}

function fromAddress(): string {
  return process.env.MAIL_FROM?.trim() || 'Distribution of Tasks <onboarding@resend.dev>';
}

export async function sendEmail(message: EmailMessage): Promise<DeliveryResult> {
  const kind = emailTransportKind();

  if (kind === 'LOCAL') {
    logLocal('EMAIL', message.to, `${message.subject}\n${message.text}`);
    return { ok: true, transport: 'LOCAL', preview: `${message.subject} — ${message.text}` };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return { ok: false, transport: 'RESEND', error: `HTTP ${response.status} ${detail.slice(0, 200)}` };
    }

    const body = (await response.json().catch(() => ({}))) as { id?: string };
    return { ok: true, transport: 'RESEND', reference: body.id };
  } catch (error) {
    return { ok: false, transport: 'RESEND', error: errorMessage(error) };
  }
}

export async function sendSms(message: SmsMessage): Promise<DeliveryResult> {
  const kind = smsTransportKind();

  if (kind === 'LOCAL') {
    logLocal('SMS', message.to, message.text);
    return { ok: true, transport: 'LOCAL', preview: message.text };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID!.trim();
  const token = process.env.TWILIO_AUTH_TOKEN!.trim();
  const from = process.env.TWILIO_FROM_NUMBER!.trim();

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: message.to, From: from, Body: message.text }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return { ok: false, transport: 'TWILIO', error: `HTTP ${response.status} ${detail.slice(0, 200)}` };
    }

    const body = (await response.json().catch(() => ({}))) as { sid?: string };
    return { ok: true, transport: 'TWILIO', reference: body.sid };
  } catch (error) {
    return { ok: false, transport: 'TWILIO', error: errorMessage(error) };
  }
}

function logLocal(channel: string, to: string, text: string): void {
  if (process.env.NODE_ENV === 'test') return;
  console.info(
    `\n┌── ${channel} (no provider configured — not actually sent)\n│ to: ${to}\n${text
      .split('\n')
      .map((line) => `│ ${line}`)
      .join('\n')}\n└──\n`,
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
