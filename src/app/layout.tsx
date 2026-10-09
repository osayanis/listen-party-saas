import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "./globals.css";

// DA OsaNotch : Bricolage Grotesque (titres) + Inter (texte), pour tout le site.
const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-osa-display" });
const sans = Inter({ subsets: ["latin"], variable: "--font-osa-sans" });

export const metadata: Metadata = {
  title: "OsaParty · Écoutez ensemble",
  description: "Écoute synchronisée Apple Music entre amis : paroles, chat, réactions et blind test. Par OsaLabs.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "OsaParty" },
};
export const viewport: Viewport = { themeColor: "#0a0a0c" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${display.variable} ${sans.variable}`}>
      <body className="antialiased bg-[#0a0a0c] text-white" style={{ fontFamily: "var(--font-osa-sans), system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
