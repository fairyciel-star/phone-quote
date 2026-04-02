import type { ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
  readonly selected?: boolean;
  readonly onClick?: () => void;
  readonly children: ReactNode;
  readonly className?: string;
}

export function Card({ selected = false, onClick, children, className = '' }: CardProps) {
  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ''} ${className}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <span className={styles.checkmark}>✓</span>
      {children}
    </div>
  );
}
