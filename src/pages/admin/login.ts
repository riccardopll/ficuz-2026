import type { APIRoute } from "astro";

import {
  ADMIN_COOKIE_NAME,
  createAdminSessionValue,
  getAdminCookieOptions,
  getSafeRedirectPath,
  passwordsMatch,
  redirect,
} from "../../lib/admin-auth";

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const form = await request.formData();
  const enteredPassword = String(form.get("password") ?? "");
  const next = getSafeRedirectPath(String(form.get("next") ?? "/"));
  const back = new URL(next, request.url);
  const invalidUrl = new URL(back);
  invalidUrl.searchParams.set("admin", "1");
  invalidUrl.searchParams.set("error", "invalid");
  const { ADMIN_PASSWORD: password, ADMIN_COOKIE_SECRET: cookieSecret } = locals.runtime.env;

  if (!password || !cookieSecret) {
    return Response.json({ error: "Admin auth is not configured" }, { status: 500 });
  }

  if (!passwordsMatch(enteredPassword, password)) {
    return redirect(invalidUrl);
  }

  cookies.set(
    ADMIN_COOKIE_NAME,
    createAdminSessionValue(cookieSecret),
    getAdminCookieOptions(request),
  );

  return redirect(back);
};
