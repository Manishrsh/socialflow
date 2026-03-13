import webpush from 'web-push';
import { sql } from '@/lib/db';

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  process.env.VAPID_PUBLIC_KEY ||
  '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const rawVapidSubject = (process.env.VAPID_SUBJECT || '').trim();
const VAPID_SUBJECT = rawVapidSubject
  ? rawVapidSubject.includes(':')
    ? rawVapidSubject
    : `mailto:${rawVapidSubject}`
  : 'mailto:admin@example.com';

let vapidConfigured = false;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfigured = true;
}

export function getPushPublicKey() {
  return VAPID_PUBLIC_KEY;
}

export function isPushConfigured() {
  return vapidConfigured;
}

export async function sendPushToWorkspace(
  workspaceId: string,
  payload: Record<string, unknown>
) {
  if (!vapidConfigured) {
    return { sent: 0, removed: 0, skipped: true };
  }

  const rows = await sql`
    SELECT id, endpoint, subscription
    FROM push_subscriptions
    WHERE workspace_id = ${workspaceId}
  `;

  let sent = 0;
  let removed = 0;

  for (const row of rows || []) {
    const subscription =
      typeof row.subscription === 'string'
        ? JSON.parse(row.subscription || '{}')
        : (row.subscription || {});

    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      sent += 1;
    } catch (error: any) {
      const statusCode = Number(error?.statusCode || 0);
      if (statusCode === 404 || statusCode === 410) {
        await sql`DELETE FROM push_subscriptions WHERE id = ${row.id}`;
        removed += 1;
      }
    }
  }

  return { sent, removed, skipped: false };
}
