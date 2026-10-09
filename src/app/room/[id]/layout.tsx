import type { Metadata } from "next";

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  return {
    title: `Salon #${params.id} · OsaParty`,
    description: "Écoute synchronisée entre amis — rejoins la soirée.",
  };
}

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
