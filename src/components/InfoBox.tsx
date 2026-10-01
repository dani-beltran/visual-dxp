import { ExternalLink, Info } from 'lucide-react';
import type { ReactNode } from 'react';

interface InfoBoxProps {
  children: ReactNode;
  className?: string;
  source?: { label: string; href: string };
}

export function InfoBox({ children, className = '', source }: InfoBoxProps) {
  return (
    <div className={`dxp-inspector-note ${className}`}>
      <Info size={15} aria-hidden="true" />
      <p>
        {children}
        {source && (
          <a
            className="dxp-inspector-note-source"
            href={source.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {source.label} <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}
      </p>
    </div>
  );
}
