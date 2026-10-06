import '../../styles/base.css';
import '../../styles/shared.css';
import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import './InfoBox.css';

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
