import { getCurrentUser } from "@/lib/session";
import { getFavoriteIds, getCartCount } from "@/lib/shopping";
import { updateUserProfile } from "@/lib/users";
import { readJson, jsonError } from "@/lib/http";
import { sanitizeText, isSafeHttpUrl } from "@/lib/validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ user: null });
  }

  const favoriteIds = await getFavoriteIds(user.id);
  const cartCount = await getCartCount(user.id);

  return Response.json({
    user,
    favoriteIds,
    cartCount,
  });
}

export async function PUT(request) {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("Sessão não autenticada.", 401);
  }

  const body = await readJson(request);
  if (!body) {
    return jsonError("Dados de perfil inválidos.");
  }

  let avatarUrl = undefined;
  if (body.avatarUrl !== undefined) {
    const rawAvatar = String(body.avatarUrl || "").trim();
    if (rawAvatar === "") {
      avatarUrl = null;
    } else if (rawAvatar.startsWith("data:image/")) {
      // Aceita Data URL Base64 de imagem
      avatarUrl = rawAvatar.slice(0, 500000); // Limite de 500KB
    } else if (isSafeHttpUrl(rawAvatar)) {
      avatarUrl = rawAvatar;
    } else {
      avatarUrl = null;
    }
  }

  const name = body.name !== undefined ? sanitizeText(body.name).slice(0, 100) : undefined;
  const bio = body.bio !== undefined ? sanitizeText(body.bio).slice(0, 500) : undefined;
  const preferences = Array.isArray(body.preferences)
    ? body.preferences.map((p) => sanitizeText(p).slice(0, 50)).filter(Boolean)
    : undefined;

  try {
    const updatedUser = await updateUserProfile(user.id, {
      name,
      avatarUrl,
      bio,
      preferences,
    });

    return Response.json({
      ok: true,
      user: updatedUser,
    });
  } catch (err) {
    console.error("[the-store] Erro ao atualizar perfil:", err);
    return jsonError("Não foi possível atualizar o perfil no momento.", 500);
  }
}

