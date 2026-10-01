import { ChevronDown } from 'lucide-react';
import type { ComponentPropsWithRef } from 'react';
import '../styles/select.css';

export function Select({ children, className = '', ...props }: ComponentPropsWithRef<'select'>) {
  return (
    <span className="dxp-select">
      <select className={`dxp-select-control ${className}`} {...props}>
        {children}
      </select>
      <ChevronDown size={13} aria-hidden="true" />
    </span>
  );
}
