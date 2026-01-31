'use client';

import { classNames } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={classNames('bg-card border border-border rounded-xl', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: CardProps) {
  return (
    <div className={classNames('px-6 py-4 border-b border-border', className)}>
      {children}
    </div>
  );
}

export function CardContent({ children, className }: CardProps) {
  return <div className={classNames('px-6 py-4', className)}>{children}</div>;
}
