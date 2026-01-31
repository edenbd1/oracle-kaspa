'use client';

import Link from 'next/link';
import { WalletButton } from '@/components/WalletButton';

export default function PmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link href="/pm" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="font-bold text-primary-foreground">K</span>
                </div>
                <span className="font-semibold text-lg">Kaspa PM</span>
              </Link>
              <nav className="hidden md:flex items-center gap-6">
                <Link
                  href="/pm"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Markets
                </Link>
                <Link
                  href="/pm/wallet"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Wallet
                </Link>
              </nav>
            </div>
            <WalletButton />
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
