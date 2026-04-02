import type { ReactNode } from 'react';
import styles from './Badge.module.css';

interface BadgeProps {
  readonly variant?: 'default' | 'success' | 'carrier';
  readonly color?: string;
  readonly children: ReactNode;
}

export function Badge({ variant = 'default', color, children }: BadgeProps) {
  const style = variant === 'carrier' && color ? { backgroundColor: color } : undefined;
  return (
    <span className={`${styles.badge} ${styles[variant]}`} style={style}>
      {children}
    </span>
  );
}
