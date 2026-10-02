import { vi } from 'vitest';

// Next enforces this import at build time. Unit tests run outside its RSC loader.
vi.mock('server-only', () => ({}));

// Exporters are enabled explicitly in the observability integration tests.
process.env.OTEL_SDK_DISABLED = 'true';
