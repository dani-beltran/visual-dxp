'use client';

import { App } from '../app';
import { createActivityStore } from '../lib/activity';

const activityStore = createActivityStore([]);

export default function Demo() {
  return (
    <App
      activityStore={activityStore}
      persistenceKey="dlb-dxp-workflow-v1"
      ai={{ endpoint: '/api/ai/chat', credentials: 'same-origin' }}
    />
  );
}
