/**
 * OpenTelemetry distributed tracing setup for AfriSend API.
 *
 * Initialises the NodeSDK with auto-instrumentation and exports traces to
 * an OTLP-compatible collector (Jaeger or OTEL Collector).
 *
 * MUST be imported before any other application code:
 *   import './telemetry/tracing';
 *
 * Environment variables:
 *   OTEL_EXPORTER_OTLP_ENDPOINT  — collector URL (default: http://localhost:4318)
 *   OTEL_SERVICE_NAME             — service name (default: afrisend-api)
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? 'afrisend-api';
const OTLP_ENDPOINT =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4318';

const exporter = new OTLPTraceExporter({
  url: `${OTLP_ENDPOINT}/v1/traces`,
});

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '1.0.0',
  }),
  traceExporter: exporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-express': { enabled: true },
      '@opentelemetry/instrumentation-pg': { enabled: true },
      '@opentelemetry/instrumentation-ioredis': { enabled: true },
    }),
  ],
});

/**
 * Start the OpenTelemetry SDK.
 * Call this once at application startup, before importing other modules.
 */
export function startTracing(): void {
  if (process.env.NODE_ENV === 'test') return;
  sdk.start();
  process.on('SIGTERM', () => {
    sdk.shutdown().catch(console.error);
  });
}

export { sdk };
