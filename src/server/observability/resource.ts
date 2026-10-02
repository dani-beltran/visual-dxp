import { detectResources, envDetector, resourceFromAttributes } from '@opentelemetry/resources';

/** Use the SDK parser and its standard OTEL_SERVICE_NAME precedence. */
export function telemetryResource() {
  const configured = detectResources({ detectors: [envDetector] });
  return resourceFromAttributes({
    'service.name': 'visual-dxp',
    'deployment.environment.name':
      configured.attributes['deployment.environment.name'] ??
      configured.attributes['deployment.environment'] ??
      process.env.OTEL_DEPLOYMENT_ENVIRONMENT ??
      'development',
  }).merge(configured);
}
