/**
 * Kong API Gateway configuration tests — TDD (DevOps)
 *
 * Validates that Kong is properly configured in docker-compose.yml
 * and that kong.yml declarative config meets the architecture requirements:
 * - Kong + Kong-DB (PostgreSQL) in docker-compose
 * - Routes proxy to the Express backend for all v1 API endpoints
 * - JWT validation plugin (RS256)
 * - Rate limiting plugin (token bucket)
 * - Request logging plugin (sanitized - no PII)
 * - Health check route
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const ROOT = path.resolve(__dirname, '../..');
const DOCKER_COMPOSE_PATH = path.join(ROOT, 'docker-compose.yml');
const KONG_CONFIG_PATH = path.join(ROOT, 'kong', 'kong.yml');

function readDockerCompose(): Record<string, unknown> {
  const content = fs.readFileSync(DOCKER_COMPOSE_PATH, 'utf-8');
  return yaml.load(content) as Record<string, unknown>;
}

function readKongConfig(): Record<string, unknown> {
  const content = fs.readFileSync(KONG_CONFIG_PATH, 'utf-8');
  return yaml.load(content) as Record<string, unknown>;
}

describe('docker-compose.yml — Kong services', () => {
  let compose: Record<string, unknown>;

  beforeAll(() => {
    compose = readDockerCompose();
  });

  it('file exists', () => {
    expect(fs.existsSync(DOCKER_COMPOSE_PATH)).toBe(true);
  });

  it('includes a kong-db (PostgreSQL) service', () => {
    const services = compose.services as Record<string, unknown>;
    expect(services).toHaveProperty('kong-db');
    const kongDb = services['kong-db'] as Record<string, unknown>;
    const image = kongDb.image as string;
    expect(image).toMatch(/postgres/i);
  });

  it('includes a kong service', () => {
    const services = compose.services as Record<string, unknown>;
    expect(services).toHaveProperty('kong');
  });

  it('kong uses the official Kong Docker image', () => {
    const services = compose.services as Record<string, unknown>;
    const kong = services.kong as Record<string, unknown>;
    const image = kong.image as string;
    expect(image).toMatch(/kong/i);
  });

  it('kong exposes port 8000 (proxy)', () => {
    const services = compose.services as Record<string, unknown>;
    const kong = services.kong as Record<string, unknown>;
    const ports = kong.ports as string[];
    const hasProxy = ports.some((p: string) => String(p).includes('8000'));
    expect(hasProxy).toBe(true);
  });

  it('kong exposes port 8001 (admin API)', () => {
    const services = compose.services as Record<string, unknown>;
    const kong = services.kong as Record<string, unknown>;
    const ports = kong.ports as string[];
    const hasAdmin = ports.some((p: string) => String(p).includes('8001'));
    expect(hasAdmin).toBe(true);
  });

  it('kong depends on kong-db', () => {
    const services = compose.services as Record<string, unknown>;
    const kong = services.kong as Record<string, unknown>;
    const dependsOn = kong.depends_on as Record<string, unknown> | string[];
    if (Array.isArray(dependsOn)) {
      expect(dependsOn).toContain('kong-db');
    } else {
      expect(dependsOn).toHaveProperty('kong-db');
    }
  });

  it('kong-migrations service exists to run DB migrations', () => {
    const services = compose.services as Record<string, unknown>;
    expect(services).toHaveProperty('kong-migrations');
  });

  it('kong has a healthcheck configured', () => {
    const services = compose.services as Record<string, unknown>;
    const kong = services.kong as Record<string, unknown>;
    expect(kong).toHaveProperty('healthcheck');
  });

  it('kong environment sets KONG_DATABASE to postgres', () => {
    const services = compose.services as Record<string, unknown>;
    const kong = services.kong as Record<string, unknown>;
    const env = kong.environment as Record<string, string>;
    expect(env['KONG_DATABASE']).toBe('postgres');
  });

  it('kong backend route is only accessible through kong (backend port not exposed to host)', () => {
    const services = compose.services as Record<string, unknown>;
    const backend = services.backend as Record<string, unknown>;
    // Backend should not expose port 3000 to host directly once Kong is in place
    // (ports should be empty or removed)
    const ports = (backend.ports as string[] | undefined) ?? [];
    const exposesDirectly = ports.some((p: string) => String(p).startsWith('3000:') || p === '3000');
    expect(exposesDirectly).toBe(false);
  });
});

describe('kong/kong.yml — declarative configuration', () => {
  let config: Record<string, unknown>;

  beforeAll(() => {
    config = readKongConfig();
  });

  it('file exists at kong/kong.yml', () => {
    expect(fs.existsSync(KONG_CONFIG_PATH)).toBe(true);
  });

  it('has _format_version set', () => {
    expect(config).toHaveProperty('_format_version');
  });

  it('defines services', () => {
    expect(config).toHaveProperty('services');
    const services = config.services as unknown[];
    expect(services.length).toBeGreaterThan(0);
  });

  it('has a service named afrisend-backend', () => {
    const services = config.services as Array<Record<string, unknown>>;
    const backend = services.find(s => s.name === 'afrisend-backend');
    expect(backend).toBeDefined();
  });

  it('backend service points to correct upstream host', () => {
    const services = config.services as Array<Record<string, unknown>>;
    const backend = services.find(s => s.name === 'afrisend-backend');
    expect(backend?.host).toBe('backend');
    expect(backend?.port).toBe(3000);
  });

  it('defines routes for all v1 API paths', () => {
    const services = config.services as Array<Record<string, unknown>>;
    const backend = services.find(s => s.name === 'afrisend-backend');
    const routes = backend?.routes as Array<Record<string, unknown>>;
    expect(routes).toBeDefined();

    const routePaths = routes.flatMap(r => (r.paths as string[]) ?? []);
    expect(routePaths.some(p => p.includes('/v1/auth'))).toBe(true);
    expect(routePaths.some(p => p.includes('/v1/users'))).toBe(true);
    expect(routePaths.some(p => p.includes('/v1/kyc'))).toBe(true);
    expect(routePaths.some(p => p.includes('/v1/remittance'))).toBe(true);
    expect(routePaths.some(p => p.includes('/v1/transactions'))).toBe(true);
    expect(routePaths.some(p => p.includes('/health'))).toBe(true);
  });

  it('defines plugins', () => {
    expect(config).toHaveProperty('plugins');
    const plugins = config.plugins as unknown[];
    expect(plugins.length).toBeGreaterThan(0);
  });

  it('has a JWT plugin configured', () => {
    const plugins = config.plugins as Array<Record<string, unknown>>;
    const jwt = plugins.find(p => p.name === 'jwt');
    expect(jwt).toBeDefined();
  });

  it('JWT plugin uses RS256 algorithm', () => {
    const plugins = config.plugins as Array<Record<string, unknown>>;
    const jwt = plugins.find(p => p.name === 'jwt');
    const configBlock = jwt?.config as Record<string, unknown>;
    const algorithms = configBlock?.['allowed_algorithms'] as string[] | undefined;
    expect(algorithms).toContain('RS256');
  });

  it('has a rate-limiting plugin configured', () => {
    const plugins = config.plugins as Array<Record<string, unknown>>;
    const rateLimiter = plugins.find(p => p.name === 'rate-limiting');
    expect(rateLimiter).toBeDefined();
  });

  it('rate-limiting plugin uses redis or local policy', () => {
    const plugins = config.plugins as Array<Record<string, unknown>>;
    const rateLimiter = plugins.find(p => p.name === 'rate-limiting');
    const configBlock = rateLimiter?.config as Record<string, unknown>;
    const policy = configBlock?.['policy'] as string;
    expect(['redis', 'local', 'cluster']).toContain(policy);
  });

  it('has a request-transformer or file-log plugin for sanitized logging', () => {
    const plugins = config.plugins as Array<Record<string, unknown>>;
    const hasLogger = plugins.some(
      p => p.name === 'file-log' || p.name === 'http-log' || p.name === 'tcp-log' || p.name === 'udp-log'
    );
    expect(hasLogger).toBe(true);
  });

  it('auth route bypasses JWT plugin (login/register should be public)', () => {
    const plugins = config.plugins as Array<Record<string, unknown>>;
    // JWT plugin should NOT apply to auth routes, or auth routes should be explicitly excluded
    // Look for a route-level jwt disable or that auth route has no jwt
    const jwt = plugins.find(p => p.name === 'jwt');
    // The jwt plugin at service level should exclude or auth route has its own disable
    // We check that at least the global jwt plugin config allows anonymous or
    // there is a route-specific override disabling jwt for auth
    expect(jwt).toBeDefined(); // JWT plugin exists

    // Verify the plugin is not globally enabled (service or route scoped), or
    // that there's an anonymous consumer for auth endpoints
    const configBlock = jwt?.config as Record<string, unknown>;
    // anonymous allows unauthenticated pass-through
    // OR the jwt is service-level scoped so auth routes don't get it
    const isRouteOrServiceScoped = jwt?.service != null || jwt?.route != null;
    const hasAnonymous = configBlock?.['anonymous'] != null;
    expect(isRouteOrServiceScoped || hasAnonymous).toBe(true);
  });
});
