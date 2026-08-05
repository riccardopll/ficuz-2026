import type { APIRoute } from "astro";

import {
  ADMIN_COOKIE_NAME,
  getAdminCookieOptions,
  getSafeRedirectPath,
  redirect,
} from "../../lib/admin-auth";

export const POST: APIRoute = async ({ request, cookies }) => {
  const form = await request.formData();
  const next = getSafeRedirectPath(String(form.get("next") ?? "/"));
  const back = new URL(next, request.url);

  cookies.delete(ADMIN_COOKIE_NAME, getAdminCookieOptions(request));

  return redirect(back);
};
