'use client';

import { useState } from 'react';
import { App } from '../components/App/App';
import { commonDXPPresets } from '../presets';
import { createLocalStorageActivityStore } from './activityStore';
import './EditorApp.css';

export default function EditorApp() {
  const [activityStore] = useState(() => createLocalStorageActivityStore('visual-dxp-activity-v1'));
  return (
    <App
      tutorial={{ websiteUrl: '/demo-site.html' }}
      presets={commonDXPPresets}
      activityStore={activityStore}
      persistenceKey="visual-dxp-workflow-v1"
      ai={{ endpoint: '/api/ai/chat', credentials: 'same-origin' }}
    />
  );
}
