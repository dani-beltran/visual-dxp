import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { telemetryResource } from '../../src/server/observability/resource';

beforeEach(() => {
  for (const name of [
    'OTEL_SERVICE_NAME',
    'OTEL_RESOURCE_ATTRIBUTES',
    'OTEL_DEPLOYMENT_ENVIRONMENT',
  ]) {
    vi.stubEnv(name, undefined);
  }
});
afterEach(() => vi.unstubAllEnvs());

it('retains defaults when resource configuration is absent', () => {
  expect(telemetryResource().attributes).toEqual({
    'service.name': 'visual-dxp',
    'deployment.environment.name': 'development',
  });
});

it('matches Grafana attributes and keeps the current environment convention consistent', () => {
  vi.stubEnv('OTEL_SERVICE_NAME', 'my-app');
  vi.stubEnv('OTEL_DEPLOYMENT_ENVIRONMENT', 'development');
  vi.stubEnv(
    'OTEL_RESOURCE_ATTRIBUTES',
    'service.name=ignored,service.namespace=my-application-group,deployment.environment=production',
  );
  expect(telemetryResource().attributes).toEqual({
    'service.name': 'my-app',
    'service.namespace': 'my-application-group',
    'deployment.environment': 'production',
    'deployment.environment.name': 'production',
  });
});

it('honors explicit modern environment attributes and SDK percent decoding', () => {
  vi.stubEnv(
    'OTEL_RESOURCE_ATTRIBUTES',
    'service.name=custom,deployment.environment=production,deployment.environment.name=staging,service.version=a%2Cb%3Dc',
  );
  expect(telemetryResource().attributes).toMatchObject({
    'service.name': 'custom',
    'deployment.environment.name': 'staging',
    'service.version': 'a,b=c',
  });
});

it('malformed resource attributes do not break initialization', () => {
  vi.stubEnv('OTEL_RESOURCE_ATTRIBUTES', 'service.namespace=%invalid');
  vi.stubEnv('OTEL_SERVICE_NAME', 'my-app');
  expect(telemetryResource().attributes['service.name']).toBe('my-app');
});
