import type { Metadata } from 'next';
import { WalletProvider } from '@/lib/hooks/useWallet';
import './globals.css';

export const metadata: Metadata = {
  title: 'Threshold',
  description: 'Binary outcome markets on Kaspa',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
