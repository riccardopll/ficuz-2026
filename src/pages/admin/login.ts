import type { APIRoute } from "astro";

import {
  ADMIN_COOKIE_NAME,
  createAdminSessionValue,
  getAdminAuth,
  getAdminCookieOptions,
  getSafeRedirectPath,
  passwordsMatch,
  redirect,
} from "../../lib/admin-auth";

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const formData = await request.formData();
  const submittedPassword = String(formData.get("password") ?? "");
  const next = getSafeRedirectPath(String(formData.get("next") ?? "/"));
  const invalidRedirectUrl = new URL(next, request.url);
  invalidRedirectUrl.searchParams.set("admin", "1");
  invalidRedirectUrl.searchParams.set("error", "invalid");
  const { password, cookieSecret } = getAdminAuth(locals.runtime.env);

  if (!password || !cookieSecret) {
    return Response.json({ error: "Admin auth is not configured" }, { status: 500 });
  }

  if (!passwordsMatch(submittedPassword, password)) {
    return redirect(invalidRedirectUrl);
  }

  cookies.set(
    ADMIN_COOKIE_NAME,
    createAdminSessionValue(cookieSecret),
    getAdminCookieOptions(request),
  );

  return redirect(new URL(next, request.url));
};
