'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletButton } from '@/components/WalletButton';
import { ThresholdLogo } from '@/components/ThresholdLogo';
import { PriceTicker } from '@/components/PriceTicker';
import { useEvents } from '@/lib/hooks/useMarkets';
import { formatPrice, classNames } from '@/lib/utils';

function MarketsDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useEvents(15000);
  const prices = data?.oracle_prices || {};
  const events = data?.events || [];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={classNames(
          'px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors flex items-center gap-1',
          open ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Markets
        <svg className={classNames('w-3 h-3 transition-transform', open && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-card border border-border rounded-lg shadow-lg overflow-hidden animate-slide-in z-50">
          {events.map((event) => {
            const price = prices[event.asset];
            return (
              <Link
                key={event.id}
                href={`/pm#${event.asset.toLowerCase()}`}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div>
                  <div className="text-sm font-semibold text-foreground">{event.asset}</div>
                  <div className="text-xs text-muted-foreground">{event.market_count} markets</div>
                </div>
                {price != null && (
                  <span className="text-sm font-bold text-foreground">{formatPrice(price)}</span>
                )}
              </Link>
            );
          })}
          {events.length === 0 && (
            <div className="px-4 py-3 text-sm text-muted-foreground">Loading...</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl">
        <div className="border-b border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-6">
                <Link href="/pm" className="flex items-center gap-2.5 group">
                  <ThresholdLogo size={24} className="text-primary group-hover:text-primary/80 transition-colors" />
                  <span className="font-semibold text-foreground tracking-tight">
                    Threshold
                  </span>
                </Link>
                <nav className="hidden sm:flex items-center gap-1">
                  <MarketsDropdown />
                  <Link
                    href="/pm/wallet"
                    className={classNames(
                      'px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors',
                      pathname === '/pm/wallet'
                        ? 'text-foreground bg-muted'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Portfolio
                  </Link>
                </nav>
              </div>
              <WalletButton />
            </div>
          </div>
        </div>
        <PriceTicker />
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  );
}
