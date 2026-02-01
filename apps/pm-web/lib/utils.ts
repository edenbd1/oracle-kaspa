export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatKas(amount: number, precision: 'full' | 'compact' = 'full'): string {
  if (precision === 'compact') {
    // Compact: 2 decimals for display in tight spaces
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' KAS';
  }
  // Full precision: show up to 8 decimals (Kaspa has 8 decimal places)
  // But trim trailing zeros for cleaner display
  const formatted = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
  // Remove unnecessary trailing zeros after the minimum 2 decimals
  const cleaned = formatted.replace(/(\.\d{2})0+$/, '$1').replace(/(\.\d*[1-9])0+$/, '$1');
  return cleaned + ' KAS';
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatProbability(price: number): string {
  return `${Math.round(price * 100)}%`;
}

export function formatCents(price: number): string {
  return `${Math.round(price * 100)}¢`;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Ended';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    const remainingMinutes = minutes % 60;
    return `${days}d ${remainingHours}h ${remainingMinutes}m`;
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${seconds}s`;
}

export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function truncateAddress(address: string, chars: number = 8): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
