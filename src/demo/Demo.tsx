'use client';

import { useState } from 'react';
import { App } from '../app';
import { commonDXPPresets } from '../presets';
import { createLocalStorageActivityStore } from './activityStore';

export default function Demo() {
  const [activityStore] = useState(() => createLocalStorageActivityStore('visual-dxp-activity-v1'));
  return (
    <App
      presets={commonDXPPresets}
      activityStore={activityStore}
      persistenceKey="visual-dxp-workflow-v1"
      ai={{ endpoint: '/api/ai/chat', credentials: 'same-origin' }}
    />
  );
}
