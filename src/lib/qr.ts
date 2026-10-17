/**
 * QR payload formats used by the system.
 *
 *   Session QR (shown by the teacher, scanned by students):
 *     BSHS-ATT:S:<sessionId>:<token>
 *
 *   Student ID QR (printed on / shown from the student's profile, scanned by the teacher):
 *     BSHS-ATT:ID:<studentId>
 *
 * In this prototype the token is a random string kept in localStorage. A
 * production version should sign it server-side (e.g. HMAC with an expiry) so
 * a screenshot of the code cannot be reused outside the session window.
 */

const PREFIX = 'BSHS-ATT';

export type QrPayload =
  | { kind: 'session'; sessionId: string; token: string }
  | { kind: 'student'; studentId: string };

export function buildSessionPayload(sessionId: string, token: string): string {
  return `${PREFIX}:S:${sessionId}:${token}`;
}

export function buildStudentPayload(studentId: string): string {
  return `${PREFIX}:ID:${studentId}`;
}

export function parseQrPayload(raw: string): QrPayload | null {
  const text = raw.trim();
  const parts = text.split(':');
  if (parts[0] !== PREFIX) return null;
  if (parts[1] === 'S' && parts.length === 4 && parts[2] && parts[3]) {
    return { kind: 'session', sessionId: parts[2], token: parts[3] };
  }
  if (parts[1] === 'ID' && parts.length === 3 && parts[2]) {
    return { kind: 'student', studentId: parts[2] };
  }
  return null;
}
