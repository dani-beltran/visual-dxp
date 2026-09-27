import type { NextConfig } from 'next';

const config: NextConfig = {
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
    'langchain',
    '@langchain/core',
    '@langchain/openai',
    '@langchain/langgraph',
  ],
};

export default config;
