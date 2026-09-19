import React from 'react';
import ReactDOM from 'react-dom/client';
import { DXPBuilder } from './DXPBuilder';
import './styles/demo.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DXPBuilder
      persistenceKey="forma-dxp-workflow-v1"
      ai={
        import.meta.env.VITE_DXP_AI_ENDPOINT
          ? { endpoint: import.meta.env.VITE_DXP_AI_ENDPOINT }
          : undefined
      }
    />
  </React.StrictMode>,
);
