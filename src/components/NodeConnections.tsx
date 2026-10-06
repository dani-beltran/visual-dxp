import type { Connection } from '@xyflow/react';
import { useId, useState } from 'react';
import { useBuilderI18n } from '../lib/i18nContext';
import type { WorkflowNode } from '../lib/types';

/** Keyboard equivalent of dragging the editor's single-output handles. */
export function NodeConnections({
  node,
  nodes,
  onConnect,
}: {
  node: WorkflowNode;
  nodes: WorkflowNode[];
  onConnect: (connection: Connection) => void;
}) {
  const { t } = useBuilderI18n();
  const [target, setTarget] = useState('');
  const id = useId();
  if (['note', 'frame', 'fork', 'loop', 'experiment'].includes(node.data.kind)) return null;
  const targets = nodes.filter(
    (n) => n.id !== node.id && !['trigger', 'note', 'frame'].includes(n.data.kind),
  );
  return (
    <div className="dxp-node-connections" data-tutorial="connections">
      <label htmlFor={id}>{t('tutorial.connectTo')}</label>
      <select
        id={id}
        value={targets.some((n) => n.id === target) ? target : ''}
        onChange={(e) => setTarget(e.target.value)}
      >
        <option value="">{t('tutorial.chooseTarget')}</option>
        {targets.map((n) => (
          <option value={n.id} key={n.id}>
            {n.data.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="dxp-button"
        disabled={!targets.some((n) => n.id === target)}
        onClick={() =>
          onConnect({ source: node.id, target, sourceHandle: null, targetHandle: null })
        }
      >
        {t('tutorial.connectAction')}
      </button>
    </div>
  );
}
