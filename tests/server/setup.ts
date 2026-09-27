import { vi } from 'vitest';

// Next enforces this import at build time. Unit tests run outside its RSC loader.
vi.mock('server-only', () => ({}));
