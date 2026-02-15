'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletButton } from '@/components/WalletButton';
import { ThresholdLogo } from '@/components/ThresholdLogo';
import { classNames } from '@/lib/utils';

export default function PmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { href: '/pm', label: 'Markets' },
    { href: '/pm/wallet', label: 'Portfolio' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
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
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={classNames(
                        'px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors',
                        isActive
                          ? 'text-foreground bg-muted'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <WalletButton />
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  );
}
