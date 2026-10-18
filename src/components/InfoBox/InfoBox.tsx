import '../../styles/base.css';
import '../../styles/shared.css';
import { ChevronDown, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import './InfoBox.css';

interface InfoBoxProps {
  children: ReactNode;
  className?: string;
  summary?: string;
}

export function InfoBox({ children, className = '', summary }: InfoBoxProps) {
  if (summary) {
    return (
      <details className={`dxp-inspector-note dxp-inspector-note-accordion ${className}`}>
        <summary>
          <Info size={15} aria-hidden="true" />
          <span>{summary}</span>
          <ChevronDown size={14} className="dxp-inspector-note-chevron" aria-hidden="true" />
        </summary>
        <p>{children}</p>
      </details>
    );
  }
  return (
    <div className={`dxp-inspector-note ${className}`}>
      <Info size={15} aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
