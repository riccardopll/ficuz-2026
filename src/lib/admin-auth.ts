import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE_NAME = "ficuz_admin";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

const COOKIE_VERSION = "v1";

type ReadableCookies = {
  get(name: string): { value: string } | undefined;
};

function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function getSafeRedirectPath(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }

  return next;
}

export function redirect(location: string | URL) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location.toString(),
    },
  });
}

export function getAdminAuth(env: Partial<Pick<Env, "ADMIN_PASSWORD" | "ADMIN_COOKIE_SECRET">>) {
  return {
    password: env.ADMIN_PASSWORD,
    cookieSecret: env.ADMIN_COOKIE_SECRET,
  };
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
  const [version, issuedAtRaw] = payload.split(".");

  if (version !== COOKIE_VERSION) {
    return false;
  }

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt) || now - issuedAt > ADMIN_COOKIE_MAX_AGE * 1000) {
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
  const url = new URL(request.url);

  return {
    httpOnly: true,
    maxAge: ADMIN_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax" as const,
    secure: url.protocol === "https:",
  };
}

export function passwordsMatch(submitted: string, expected: string | undefined) {
  if (!expected) {
    return false;
  }

  return constantTimeEqual(submitted, expected);
}
