'use client';

import { useState } from 'react';
import { App } from '../app';
import { createLocalStorageActivityStore } from './activityStore';

export default function Demo() {
  const [activityStore] = useState(() => createLocalStorageActivityStore('dlb-dxp-activity-v1'));
  return (
    <App
      activityStore={activityStore}
      persistenceKey="dlb-dxp-workflow-v1"
      ai={{ endpoint: '/api/ai/chat', credentials: 'same-origin' }}
    />
  );
}
