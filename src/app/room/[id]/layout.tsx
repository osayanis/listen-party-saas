import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";

// Polices de la DA OsaNotch, chargées uniquement pour le salon
// (la page de création garde son style).
const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-osa-display" });
const sans = Inter({ subsets: ["latin"], variable: "--font-osa-sans" });

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  return {
    title: `Salon #${params.id} · OsaParty`,
    description: "Écoute synchronisée entre amis — rejoins la soirée.",
  };
}

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} ${sans.variable}`} style={{ fontFamily: "var(--font-osa-sans), system-ui, sans-serif" }}>
      {children}
    </div>
  );
}
