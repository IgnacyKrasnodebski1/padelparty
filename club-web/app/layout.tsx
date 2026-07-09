import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'PadelParty — Panel klubu',
  description: 'Rezerwacje, ligi i statystyki Twojego klubu padlowego.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background: '#F1F2F8', color: '#14161C' }}>
        {children}
      </body>
    </html>
  );
}
