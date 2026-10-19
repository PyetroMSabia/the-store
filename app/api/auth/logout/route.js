import { destroySession } from "@/lib/session";

export async function POST() {
  await destroySession();
  return Response.json({ ok: true });
}

export async function DELETE() {
  await destroySession();
  return Response.json({ ok: true });
}
