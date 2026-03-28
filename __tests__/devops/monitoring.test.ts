/**
 * Monitoring infrastructure validation tests — TDD (DevOps)
 *
 * Validates that all monitoring config files are present and well-formed:
 * - Prometheus config with correct scrape targets
 * - Prometheus alerting rules for all required conditions
 * - Grafana datasource provisioning
 * - Grafana dashboard provisioning
 * - Alertmanager config with PagerDuty receiver
 * - docker-compose has prometheus, grafana, alertmanager services
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const ROOT = path.resolve(__dirname, '../..');
const MONITORING = path.join(ROOT, 'monitoring');

// ─── helpers ──────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadYaml(filePath: string): any {
  const content = fs.readFileSync(filePath, 'utf-8');
  return yaml.load(content);
}

// ─── Prometheus config ───────────────────────────────────────────────────────
describe('monitoring/prometheus/prometheus.yml', () => {
  const PROM_CONFIG = path.join(MONITORING, 'prometheus', 'prometheus.yml');

  it('exists', () => {
    expect(fs.existsSync(PROM_CONFIG)).toBe(true);
  });

  it('is valid YAML', () => {
    expect(() => loadYaml(PROM_CONFIG)).not.toThrow();
  });

  it('scrapes the backend /metrics endpoint', () => {
    const cfg = loadYaml(PROM_CONFIG);
    const scrapeConfigs: { job_name: string; static_configs?: { targets: string[] }[] }[] =
      cfg.scrape_configs ?? [];
    const backendJob = scrapeConfigs.find(j => j.job_name === 'afrisend-backend');
    expect(backendJob).toBeDefined();
  });

  it('references the alerting rules file', () => {
    const cfg = loadYaml(PROM_CONFIG);
    const ruleFiles: string[] = cfg.rule_files ?? [];
    expect(ruleFiles.length).toBeGreaterThan(0);
  });

  it('has alertmanager configured', () => {
    const cfg = loadYaml(PROM_CONFIG);
    const amConfigs: { static_configs?: { targets: string[] }[] }[] =
      cfg.alerting?.alertmanagers ?? [];
    expect(amConfigs.length).toBeGreaterThan(0);
  });
});

// ─── Prometheus alert rules ───────────────────────────────────────────────────
describe('monitoring/prometheus/alerts/afrisend.yml', () => {
  const ALERTS_FILE = path.join(MONITORING, 'prometheus', 'alerts', 'afrisend.yml');

  it('exists', () => {
    expect(fs.existsSync(ALERTS_FILE)).toBe(true);
  });

  it('is valid YAML', () => {
    expect(() => loadYaml(ALERTS_FILE)).not.toThrow();
  });

  function getRuleNames(): string[] {
    const cfg = loadYaml(ALERTS_FILE);
    const groups: { rules: { alert: string }[] }[] = cfg.groups ?? [];
    return groups.flatMap(g => g.rules.map(r => r.alert));
  }

  it('has a HighTransactionFailureRate alert', () => {
    expect(getRuleNames()).toContain('HighTransactionFailureRate');
  });

  it('has a PayoutProviderDown alert', () => {
    expect(getRuleNames()).toContain('PayoutProviderDown');
  });

  it('has a APIGatewayHighLatency alert', () => {
    expect(getRuleNames()).toContain('APIGatewayHighLatency');
  });

  it('has a DatabaseConnectionPoolSaturation alert', () => {
    expect(getRuleNames()).toContain('DatabaseConnectionPoolSaturation');
  });
});

// ─── Grafana datasource provisioning ─────────────────────────────────────────
describe('monitoring/grafana/provisioning/datasources/prometheus.yml', () => {
  const DS_FILE = path.join(MONITORING, 'grafana', 'provisioning', 'datasources', 'prometheus.yml');

  it('exists', () => {
    expect(fs.existsSync(DS_FILE)).toBe(true);
  });

  it('is valid YAML', () => {
    expect(() => loadYaml(DS_FILE)).not.toThrow();
  });

  it('defines a Prometheus datasource', () => {
    const cfg = loadYaml(DS_FILE);
    const datasources: { type: string; name: string }[] = cfg.datasources ?? [];
    const promDs = datasources.find(d => d.type === 'prometheus');
    expect(promDs).toBeDefined();
  });
});

// ─── Grafana dashboard provisioning ──────────────────────────────────────────
describe('monitoring/grafana/provisioning/dashboards/dashboards.yml', () => {
  const DASH_PROV = path.join(MONITORING, 'grafana', 'provisioning', 'dashboards', 'dashboards.yml');

  it('exists', () => {
    expect(fs.existsSync(DASH_PROV)).toBe(true);
  });

  it('is valid YAML', () => {
    expect(() => loadYaml(DASH_PROV)).not.toThrow();
  });
});

// ─── Grafana dashboard JSON ────────────────────────────────────────────────────
describe('monitoring/grafana/dashboards/afrisend-overview.json', () => {
  const DASH_JSON = path.join(MONITORING, 'grafana', 'dashboards', 'afrisend-overview.json');

  it('exists', () => {
    expect(fs.existsSync(DASH_JSON)).toBe(true);
  });

  it('is valid JSON', () => {
    const content = fs.readFileSync(DASH_JSON, 'utf-8');
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it('has a title field', () => {
    const dash = JSON.parse(fs.readFileSync(DASH_JSON, 'utf-8'));
    expect(typeof dash.title).toBe('string');
    expect(dash.title.length).toBeGreaterThan(0);
  });

  it('contains panels (at least 5 metrics visualised)', () => {
    const dash = JSON.parse(fs.readFileSync(DASH_JSON, 'utf-8'));
    expect(Array.isArray(dash.panels)).toBe(true);
    expect(dash.panels.length).toBeGreaterThanOrEqual(5);
  });

  it('has panels covering transaction success rates', () => {
    const dash = JSON.parse(fs.readFileSync(DASH_JSON, 'utf-8'));
    const titles: string[] = dash.panels.map((p: { title: string }) => p.title?.toLowerCase() ?? '');
    const hasTransactionPanel = titles.some(t => t.includes('transaction'));
    expect(hasTransactionPanel).toBe(true);
  });
});

// ─── Alertmanager config ──────────────────────────────────────────────────────
describe('monitoring/alertmanager/alertmanager.yml', () => {
  const AM_CONFIG = path.join(MONITORING, 'alertmanager', 'alertmanager.yml');

  it('exists', () => {
    expect(fs.existsSync(AM_CONFIG)).toBe(true);
  });

  it('is valid YAML', () => {
    expect(() => loadYaml(AM_CONFIG)).not.toThrow();
  });

  it('has a pagerduty receiver', () => {
    const cfg = loadYaml(AM_CONFIG);
    const receivers: { name: string; pagerduty_configs?: unknown[] }[] = cfg.receivers ?? [];
    const pdReceiver = receivers.find(r => r.pagerduty_configs && r.pagerduty_configs.length > 0);
    expect(pdReceiver).toBeDefined();
  });

  it('has a route directing critical alerts to pagerduty', () => {
    const cfg = loadYaml(AM_CONFIG);
    const route = cfg.route;
    expect(route).toBeDefined();
    // Check either top-level receiver or sub-routes contain a pagerduty receiver
    const receivers: { name: string; pagerduty_configs?: unknown[] }[] = cfg.receivers ?? [];
    const pdReceiver = receivers.find(r => r.pagerduty_configs && r.pagerduty_configs.length > 0);
    const pdReceiverName = pdReceiver?.name;
    const routeReceiver: string = route.receiver ?? '';
    const subRoutes: { receiver: string }[] = route.routes ?? [];
    const hasPdRoute =
      routeReceiver === pdReceiverName ||
      subRoutes.some(r => r.receiver === pdReceiverName);
    expect(hasPdRoute).toBe(true);
  });
});

// ─── docker-compose monitoring services ───────────────────────────────────────
describe('docker-compose.yml monitoring services', () => {
  const COMPOSE_FILE = path.join(ROOT, 'docker-compose.yml');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let compose: any;

  beforeAll(() => {
    compose = loadYaml(COMPOSE_FILE);
  });

  it('has a prometheus service', () => {
    expect(compose.services.prometheus).toBeDefined();
  });

  it('has a grafana service', () => {
    expect(compose.services.grafana).toBeDefined();
  });

  it('has an alertmanager service', () => {
    expect(compose.services.alertmanager).toBeDefined();
  });

  it('prometheus service uses prom/prometheus image', () => {
    expect(compose.services.prometheus.image).toMatch(/prom\/prometheus/);
  });

  it('grafana service uses grafana/grafana image', () => {
    expect(compose.services.grafana.image).toMatch(/grafana\/grafana/);
  });

  it('grafana exposes port 3001 (to avoid conflict with backend)', () => {
    const ports: string[] = compose.services.grafana.ports ?? [];
    const hasPort = ports.some(p => String(p).startsWith('3001:'));
    expect(hasPort).toBe(true);
  });
});
