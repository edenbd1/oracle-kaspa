'use client';

import { classNames } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className, hover }: CardProps) {
  return (
    <div className={classNames(
      'bg-card border border-border rounded-xl',
      hover && 'transition-all hover:border-border-light hover:shadow-[var(--shadow-md)]',
      className
    )}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={classNames('px-6 py-4 border-b border-border', className)}>
      {children}
    </div>
  );
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={classNames('px-6 py-4', className)}>{children}</div>;
}
