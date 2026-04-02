import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: 'primary' | 'secondary' | 'ghost';
  readonly fullWidth?: boolean;
  readonly size?: 'default' | 'small';
  readonly children: ReactNode;
}

export function Button({
  variant = 'primary',
  fullWidth = false,
  size = 'default',
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${fullWidth ? styles.fullWidth : ''} ${size === 'small' ? styles.small : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
