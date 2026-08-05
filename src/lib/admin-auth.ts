import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE_NAME = "ficuz_admin";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

const COOKIE_VERSION = "v1";
const REDIRECT_ORIGIN = "https://ficuz.invalid";

type ReadableCookies = {
  get(name: string): { value: string } | undefined;
};

export function getSafeRedirectPath(next: string | null | undefined) {
  if (!next || !next.startsWith("/")) {
    return "/";
  }

  const url = new URL(next, REDIRECT_ORIGIN);

  if (url.origin !== REDIRECT_ORIGIN) {
    return "/";
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function redirect(location: string | URL) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: location.toString(),
    },
  });
}

export function createAdminSessionValue(secret: string, issuedAt = Date.now()) {
  const payload = `${COOKIE_VERSION}.${issuedAt}`;
  const signature = signPayload(payload, secret);

  return `${payload}.${signature}`;
}

export function verifyAdminSessionValue(
  value: string | undefined,
  secret: string | undefined,
  now = Date.now(),
) {
  if (!value || !secret) {
    return false;
  }

  const lastDot = value.lastIndexOf(".");
  if (lastDot <= 0) {
    return false;
  }

  const payload = value.slice(0, lastDot);
  const signature = value.slice(lastDot + 1);
  const [version, rawTime] = payload.split(".");

  if (version !== COOKIE_VERSION) {
    return false;
  }

  const issuedAt = Number(rawTime);
  const age = now - issuedAt;

  if (!Number.isFinite(issuedAt) || age < 0 || age > ADMIN_COOKIE_MAX_AGE * 1000) {
    return false;
  }

  return constantTimeEqual(signature, signPayload(payload, secret));
}

export function hasValidAdminSession(
  cookies: ReadableCookies,
  env: Partial<Pick<Env, "ADMIN_COOKIE_SECRET">>,
) {
  return verifyAdminSessionValue(cookies.get(ADMIN_COOKIE_NAME)?.value, env.ADMIN_COOKIE_SECRET);
}

export function getAdminCookieOptions(request: Request) {
  return {
    httpOnly: true,
    maxAge: ADMIN_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax" as const,
    secure: new URL(request.url).protocol === "https:",
  };
}

export function passwordsMatch(submitted: string, expected: string | undefined) {
  if (!expected) {
    return false;
  }

  return constantTimeEqual(submitted, expected);
}

function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
