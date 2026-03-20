import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ThumbDrop — Collectionne YouTube',
  description: 'Ouvre des boosters, collecte des miniatures YouTube et deviens le meilleur collectionneur !',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
