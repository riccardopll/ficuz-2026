import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";

import { createDb } from "../../db";
import { players, pointTransactions } from "../../db/schema";
import { getSafeRedirectPath, hasValidAdminSession, redirect } from "../../lib/admin-auth";
import { isPointChange } from "../../lib/points";

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const form = await request.formData();
  const next = getSafeRedirectPath(String(form.get("next") ?? "/"));
  const back = new URL(next, request.url);

  if (!hasValidAdminSession(cookies, locals.runtime.env)) {
    return redirect(back);
  }

  const playerId = Number(form.get("playerId"));
  const points = Number(form.get("points"));

  if (!Number.isInteger(playerId) || !isPointChange(points)) {
    return redirect(back);
  }

  const db = createDb(locals.runtime.env.DB);
  const [player] = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  if (!player) {
    return redirect(back);
  }

  await db.insert(pointTransactions).values({
    playerId,
    points,
    reason: points > 0 ? "manual_increment" : "manual_decrement",
  });

  return redirect(back);
};
