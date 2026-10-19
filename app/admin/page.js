import { requireAdminPage } from "@/lib/session";
import { listProducts, productStats } from "@/lib/products";
import AdminDashboard from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Painel da Curadoria",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  // Controle de acesso estrito: redireciona não-autenticados para login e usuários comuns para a home
  const user = await requireAdminPage();

  const products = await listProducts();
  const stats = await productStats();

  return <AdminDashboard products={products} stats={stats} user={user} />;
}
