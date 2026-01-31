import type { Metadata } from 'next';
import { WalletProvider } from '@/lib/hooks/useWallet';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kaspa Prediction Market',
  description: 'Trade on Bitcoin price predictions using KAS',
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
