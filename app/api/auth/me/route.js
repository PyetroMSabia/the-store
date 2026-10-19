import { getCurrentUser } from "@/lib/session";
import { getFavoriteIds, getCartCount } from "@/lib/shopping";

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
