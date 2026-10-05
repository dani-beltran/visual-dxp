export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { telemetry, flushTelemetry } = await import('./server/observability/sdk');
    try {
      telemetry();
    } catch {
      /* Invalid telemetry config must not prevent serving requests. */
    }
    process.once('SIGTERM', () => {
      void flushTelemetry();
    });
    process.once('SIGINT', () => {
      void flushTelemetry();
    });
  }
}
