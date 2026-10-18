'use client';

import { useState } from 'react';
import { App } from '../components/App/App';
import { createProxyPreviewTransport } from '../lib/previewTransport';
import { commonDXPPresets } from '../presets';
import { createLocalStorageActivityStore } from './activityStore';
import './EditorApp.css';

const previewTransport = createProxyPreviewTransport();

export default function EditorApp() {
  const [activityStore] = useState(() => createLocalStorageActivityStore('visual-dxp-activity-v1'));
  return (
    <App
      previewTransport={previewTransport}
      tutorial={{ websiteUrl: '/demo-site.html' }}
      presets={commonDXPPresets}
      activityStore={activityStore}
      persistenceKey="visual-dxp-workflow-v1"
      ai={{ endpoint: '/api/ai/chat', credentials: 'same-origin' }}
    />
  );
}
