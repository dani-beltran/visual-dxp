import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app';
import { createActivityStore } from './lib/activity';
import './styles/demo.css';

const demoStartedAt = Date.now();
const minutesAgo = (minutes: number) => new Date(demoStartedAt - minutes * 60_000).toISOString();
const activityStore = createActivityStore([
  {
    id: 'demo-activity-1',
    username: 'Daniel Beltrán',
    action: 'Updated “A little welcome gift”',
    timestamp: minutesAgo(3),
  },
  {
    id: 'demo-activity-2',
    username: 'Sofia Chen',
    action: 'Connected “Find the right moment” to “Make it personal”',
    timestamp: minutesAgo(18),
  },
  {
    id: 'demo-activity-3',
    username: 'Sofia Chen',
    action: 'Added “Make it personal”',
    timestamp: minutesAgo(24),
  },
  {
    id: 'demo-activity-4',
    username: 'Alex Morgan',
    action: 'Updated “Give it a moment”',
    timestamp: minutesAgo(90),
  },
  {
    id: 'demo-activity-5',
    username: 'Daniel Beltrán',
    action: 'Exported “Welcome journey” as JavaScript',
    timestamp: minutesAgo(26 * 60),
  },
  {
    id: 'demo-activity-6',
    username: 'Alex Morgan',
    action: 'Renamed workflow to “Welcome journey”',
    timestamp: minutesAgo(50 * 60),
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App
      activityStore={activityStore}
      activityUser="Daniel Beltrán"
      persistenceKey="mr-dxp-workflow-v1"
      ai={
        import.meta.env.VITE_DXP_AI_ENDPOINT
          ? { endpoint: import.meta.env.VITE_DXP_AI_ENDPOINT }
          : undefined
      }
    />
  </React.StrictMode>,
);
