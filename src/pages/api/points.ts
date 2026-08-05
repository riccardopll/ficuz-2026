import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";

import { createDb } from "../../db";
import { players, pointTransactions } from "../../db/schema";
import { getSafeRedirectPath, hasValidAdminSession, redirect } from "../../lib/admin-auth";

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const formData = await request.formData();
  const next = getSafeRedirectPath(String(formData.get("next") ?? "/"));

  if (!hasValidAdminSession(cookies, locals.runtime.env)) {
    return redirect(new URL(next, request.url));
  }

  const playerId = Number(formData.get("playerId"));
  const delta = Number(formData.get("delta"));

  if (!Number.isInteger(playerId) || (delta !== 1 && delta !== -1)) {
    return redirect(new URL(next, request.url));
  }

  const db = createDb(locals.runtime.env.DB);
  const [player] = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  if (!player) {
    return redirect(new URL(next, request.url));
  }

  await db.insert(pointTransactions).values({
    playerId,
    points: delta,
    reason: delta > 0 ? "manual_increment" : "manual_decrement",
  });

  return redirect(new URL(next, request.url));
};
