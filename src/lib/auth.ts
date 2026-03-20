import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'scout-session';
const ONE_YEAR = 60 * 60 * 24 * 365;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET env var is not set');
  return new TextEncoder().encode(secret);
}

export type ScoutSession = {
  id: string;
  displayName: string;
  teamId: string;
  teamNumber: number;
  teamName: string;
};

export async function createSession(scout: ScoutSession) {
  const token = await new SignJWT({
    sub: scout.id,
    displayName: scout.displayName,
    teamId: scout.teamId,
    teamNumber: scout.teamNumber,
    teamName: scout.teamName,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ONE_YEAR}s`)
    .sign(getSecret());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ONE_YEAR,
    path: '/',
  });
}

export async function getSession(): Promise<ScoutSession | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      id: payload.sub as string,
      displayName: payload.displayName as string,
      teamId: payload.teamId as string,
      teamNumber: payload.teamNumber as number,
      teamName: payload.teamName as string,
    };
  } catch {
    return null;
  }
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
}
