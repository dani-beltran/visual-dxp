import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

interface InfoBoxProps {
  children: ReactNode;
  className?: string;
}

export function InfoBox({ children, className = '' }: InfoBoxProps) {
  return (
    <div className={`dxp-inspector-note ${className}`}>
      <Info size={15} aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
