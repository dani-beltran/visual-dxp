import type { NextConfig } from 'next';

const config: NextConfig = {
  env: {
    NEXT_PUBLIC_OPENAI_MODEL: process.env.OPENAI_MODEL?.trim() || '',
  },
  // Starting the app should not generate repository instruction files.
  agentRules: false,
  async headers() {
    return [
      {
        source: '/api/ai/:path*',
        // Include framework-generated responses, such as 405 and OPTIONS.
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
  // Keep the Node-only provider SDKs out of the browser and load them natively.
  serverExternalPackages: [
    'openai',
    'langchain',
    '@langchain/core',
    '@langchain/openai',
    '@langchain/langgraph',
  ],
};

export default config;
