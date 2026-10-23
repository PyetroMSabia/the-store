import { Playfair_Display, Outfit } from "next/font/google";
import { Suspense } from "react";
import Link from "next/link";
import "./globals.css";
import { NavProvider } from "@/components/NavContext";
import { UserProvider } from "@/components/UserContext";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import AuthModal from "@/components/AuthModal";


const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata = {
  title: {
    default: "The Store — Curadoria de ofertas das maiores lojas",
    template: "%s | The Store",
  },
  description:
    "Curadoria rigorosa de produtos com links de afiliados oficiais de Shopee, Shein, Mercado Livre, Amazon e mais. Ofertas verificadas com melhor avaliação e menor preço.",
  icons: { icon: "/logo.jpg" },
  other: {
    "darkreader-lock": "true",
    "color-scheme": "dark",
  },
};

export const viewport = { themeColor: "#09090a" };

export default function RootLayout({ children }) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${playfair.variable} ${outfit.variable}`}
    >
      <head>
        <meta name="darkreader-lock" content="true" />
        <meta name="color-scheme" content="dark" />
      </head>
      <body suppressHydrationWarning>
        <UserProvider>
          <Suspense fallback={null}>
            <AuthModal />
          </Suspense>
          <NavProvider>

            <div className="shell">
              <Suspense fallback={<aside className="sidebar" id="sidebar" />}>
                <Sidebar />
              </Suspense>
              <div className="main">
                <Suspense fallback={<header className="topbar" />}>
                  <Topbar />
                </Suspense>
                <main className="content">{children}</main>
                <footer className="footer">
                  <span>
                    © 2026 <span className="gold-text">The Store</span> — curadoria de ofertas e afiliados.
                    Podemos receber comissão por compras feitas via nossos links oficiais.
                  </span>
                  <div className="footer-links">
                    <Link href="/conta">Minha Conta</Link>
                    <Link href="/favoritos">Favoritos</Link>
                    <Link href="/carrinho">Carrinho</Link>
                    <Link href="/ajuda">Como funciona</Link>
                    <Link href="/ajuda#afiliados">Transparência</Link>
                  </div>
                </footer>
              </div>
            </div>
          </NavProvider>
        </UserProvider>
      </body>
    </html>
  );
}
