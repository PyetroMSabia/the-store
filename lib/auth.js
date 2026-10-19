import "server-only";
import { getCurrentUser, isAdminUser } from "./session.js";

/**
 * Validação de autorização do administrador baseada em sessão e RBAC do banco de dados.
 */
export async function isAdmin() {
  const user = await getCurrentUser();
  return isAdminUser(user);
}
