import { RESEND_EMAILS_URL } from './constants';
import { PRODUCT_NAME } from '../../brand';
import { renderHtml, renderText } from './render';
import { errorMessage, hasText, safeResponseText } from './strings';
import type { AlertRow, Candidate, DigestCadence, DigestEnv, DigestPeriod } from './types';

export const canSendEmail = (env: DigestEnv): boolean =>
  hasText(env.RESEND_API_KEY) && hasText(env.NOTIFICATION_FROM_EMAIL);

export const sendDigestEmail = async (
  env: DigestEnv,
  candidate: Candidate,
  alerts: readonly AlertRow[],
  period: DigestPeriod,
  cadence: DigestCadence,
): Promise<{ ok: true } | { ok: false; error: string }> => {
  try {
    const response = await fetch(RESEND_EMAILS_URL, {
      method: 'POST',
      headers: resendHeaders(env),
      body: JSON.stringify(resendBody(env, candidate, alerts, period, cadence)),
    });
    if (response.ok) return { ok: true };
    return await resendError(response);
  } catch (err) {
    return { ok: false, error: `resend_network: ${errorMessage(err)}` };
  }
};

const resendHeaders = (env: DigestEnv): HeadersInit => ({
  authorization: `Bearer ${env.RESEND_API_KEY ?? ''}`,
  'content-type': 'application/json',
});

const resendBody = (
  env: DigestEnv,
  candidate: Candidate,
  alerts: readonly AlertRow[],
  period: DigestPeriod,
  cadence: DigestCadence,
) => ({
  from: env.NOTIFICATION_FROM_EMAIL,
  to: [candidate.user.email],
  subject: `${PRODUCT_NAME} ${cadence} brief: ${candidate.collection.title}`,
  html: renderHtml(candidate.collection, alerts, period, cadence, env.BETTER_AUTH_URL),
  text: renderText(candidate.collection, alerts, period, cadence, env.BETTER_AUTH_URL),
});

const resendError = async (response: Response): Promise<{ ok: false; error: string }> => ({
  ok: false,
  error: `resend_${String(response.status)}: ${await safeResponseText(response)}`,
});
