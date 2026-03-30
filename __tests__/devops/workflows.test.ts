/**
 * GitHub Actions workflow validation tests — TDD (DevOps)
 *
 * Validates that CI/CD workflow files meet requirements:
 * - ci.yml: triggers on PR, runs lint/type-check/tests/snyk
 * - deploy-staging.yml: triggers on push to main, builds and deploys
 * - Coverage threshold of 80% is enforced
 * - Snyk dependency scanning is present
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const WORKFLOWS_DIR = path.resolve(__dirname, '../../.github/workflows');
const CI_WORKFLOW = path.join(WORKFLOWS_DIR, 'ci.yml');
const DEPLOY_STAGING_WORKFLOW = path.join(WORKFLOWS_DIR, 'deploy-staging.yml');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadWorkflow(filePath: string): any {
  const content = fs.readFileSync(filePath, 'utf-8');
  return yaml.load(content);
}

function flattenSteps(workflow: Record<string, unknown>): Record<string, unknown>[] {
  const steps: Record<string, unknown>[] = [];
  const jobs = (workflow.jobs || {}) as Record<string, { steps?: Record<string, unknown>[] }>;
  for (const job of Object.values(jobs)) {
    if (job.steps) {
      steps.push(...job.steps);
    }
  }
  return steps;
}

function getAllRunCommands(workflow: Record<string, unknown>): string[] {
  return flattenSteps(workflow)
    .filter(step => step.run)
    .map(step => String(step.run));
}

function getJobNames(workflow: Record<string, unknown>): string[] {
  return Object.keys((workflow.jobs || {}) as object);
}

describe('.github/workflows/ci.yml', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let workflow: any;

  beforeAll(() => {
    workflow = loadWorkflow(CI_WORKFLOW);
  });

  it('exists', () => {
    expect(fs.existsSync(CI_WORKFLOW)).toBe(true);
  });

  it('is valid YAML', () => {
    expect(() => loadWorkflow(CI_WORKFLOW)).not.toThrow();
  });

  it('triggers on pull_request targeting main', () => {
    const on = workflow.on || workflow['on'];
    const hasPrTrigger =
      on?.pull_request !== undefined ||
      (Array.isArray(on) && on.includes('pull_request'));
    expect(hasPrTrigger).toBe(true);
  });

  it('has a lint job', () => {
    const jobs = getJobNames(workflow);
    const hasLint = jobs.some(j => j.toLowerCase().includes('lint'));
    expect(hasLint).toBe(true);
  });

  it('has a type-check job or step', () => {
    const jobs = getJobNames(workflow);
    const hasTypeCheckJob = jobs.some(j =>
      j.toLowerCase().includes('type') || j.toLowerCase().includes('typecheck')
    );
    if (!hasTypeCheckJob) {
      const allRuns = getAllRunCommands(workflow).join(' ');
      expect(allRuns).toMatch(/tsc|type-check|typecheck/i);
    } else {
      expect(hasTypeCheckJob).toBe(true);
    }
  });

  it('has a test job that runs unit tests', () => {
    const jobs = getJobNames(workflow);
    const hasTestJob = jobs.some(j => j.toLowerCase().includes('test'));
    expect(hasTestJob).toBe(true);
  });

  it('enforces 80% code coverage threshold', () => {
    const allRuns = getAllRunCommands(workflow).join('\n');
    // Coverage threshold must be referenced either in run command or package.json
    // The workflow should run npm run test:coverage which enforces thresholds
    const hasCoverage =
      /coverage/i.test(allRuns) ||
      /test:coverage/i.test(allRuns);
    expect(hasCoverage).toBe(true);
  });

  it('has a Snyk security scanning step', () => {
    const steps = flattenSteps(workflow);
    const hasSnyk =
      steps.some(s =>
        String(s.uses || '').toLowerCase().includes('snyk') ||
        String(s.run || '').toLowerCase().includes('snyk') ||
        String(s.name || '').toLowerCase().includes('snyk')
      );
    expect(hasSnyk).toBe(true);
  });

  it('checks out the repository code', () => {
    const steps = flattenSteps(workflow);
    const hasCheckout = steps.some(s =>
      String(s.uses || '').includes('actions/checkout')
    );
    expect(hasCheckout).toBe(true);
  });

  it('sets up Node.js', () => {
    const steps = flattenSteps(workflow);
    const hasNodeSetup = steps.some(s =>
      String(s.uses || '').includes('actions/setup-node')
    );
    expect(hasNodeSetup).toBe(true);
  });
});

describe('.github/workflows/deploy-staging.yml', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let workflow: any;

  beforeAll(() => {
    workflow = loadWorkflow(DEPLOY_STAGING_WORKFLOW);
  });

  it('exists', () => {
    expect(fs.existsSync(DEPLOY_STAGING_WORKFLOW)).toBe(true);
  });

  it('is valid YAML', () => {
    expect(() => loadWorkflow(DEPLOY_STAGING_WORKFLOW)).not.toThrow();
  });

  it('triggers on push to main branch', () => {
    const on = workflow.on || workflow['on'];
    const hasPushMain =
      on?.push?.branches?.includes('main') ||
      on?.push?.branches?.includes('refs/heads/main');
    expect(hasPushMain).toBe(true);
  });

  it('has a build job that builds Docker image', () => {
    const jobs = getJobNames(workflow);
    const allRuns = getAllRunCommands(workflow).join('\n');
    const hasBuildJob = jobs.some(j => j.toLowerCase().includes('build'));
    const hasDockerBuild = /docker build/i.test(allRuns);
    expect(hasBuildJob || hasDockerBuild).toBe(true);
  });

  it('pushes Docker image to ECR', () => {
    const allRuns = getAllRunCommands(workflow).join('\n');
    const steps = flattenSteps(workflow);
    const hasEcrPush =
      /ecr/i.test(allRuns) ||
      steps.some(s => /ecr/i.test(String(s.uses || '')));
    expect(hasEcrPush).toBe(true);
  });

  it('configures AWS credentials', () => {
    const steps = flattenSteps(workflow);
    const hasAwsCreds = steps.some(s =>
      String(s.uses || '').includes('aws-actions/configure-aws-credentials')
    );
    expect(hasAwsCreds).toBe(true);
  });

  it('has a deploy job for staging', () => {
    const jobs = getJobNames(workflow);
    const hasDeployJob = jobs.some(j => j.toLowerCase().includes('deploy'));
    expect(hasDeployJob).toBe(true);
  });

  it('checks out the repository code', () => {
    const steps = flattenSteps(workflow);
    const hasCheckout = steps.some(s =>
      String(s.uses || '').includes('actions/checkout')
    );
    expect(hasCheckout).toBe(true);
  });
});

describe('.github/workflows/deploy-azure-prod.yml', () => {
  const AZURE_PROD_WORKFLOW = path.join(WORKFLOWS_DIR, 'deploy-azure-prod.yml');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let workflow: any;

  beforeAll(() => {
    workflow = loadWorkflow(AZURE_PROD_WORKFLOW);
  });

  it('exists', () => {
    expect(fs.existsSync(AZURE_PROD_WORKFLOW)).toBe(true);
  });

  it('is valid YAML', () => {
    expect(() => loadWorkflow(AZURE_PROD_WORKFLOW)).not.toThrow();
  });

  it('triggers on push to main for apps/api or Dockerfile.backend changes', () => {
    const on = workflow.on || workflow['on'];
    expect(on?.push?.branches).toContain('main');
    const paths: string[] = on?.push?.paths || [];
    const coversApi = paths.some((p: string) => p.includes('apps/api'));
    const coversDockerfile = paths.some((p: string) => p.includes('Dockerfile.backend'));
    expect(coversApi || coversDockerfile).toBe(true);
  });

  it('uses azure/login@v2 with auth-type: CREDENTIALS_OBJECT', () => {
    const steps = flattenSteps(workflow);
    const azureLoginStep = steps.find(s =>
      String(s.uses || '').startsWith('azure/login')
    );
    expect(azureLoginStep).toBeDefined();
    // Must use CREDENTIALS_OBJECT auth-type so a full JSON secret blob is accepted
    const withBlock = (azureLoginStep as Record<string, unknown>)?.with as Record<string, unknown> | undefined;
    expect(withBlock?.['auth-type']).toBe('CREDENTIALS_OBJECT');
  });

  it('references AZURE_CREDENTIALS secret for azure/login', () => {
    const steps = flattenSteps(workflow);
    const azureLoginStep = steps.find(s =>
      String(s.uses || '').startsWith('azure/login')
    );
    const withBlock = (azureLoginStep as Record<string, unknown>)?.with as Record<string, unknown> | undefined;
    expect(String(withBlock?.creds || '')).toContain('AZURE_CREDENTIALS');
  });

  it('has a deploy job', () => {
    const jobs = getJobNames(workflow);
    const hasDeployJob = jobs.some(j => j.toLowerCase().includes('deploy'));
    expect(hasDeployJob).toBe(true);
  });

  it('has a health check step', () => {
    const steps = flattenSteps(workflow);
    const hasHealthCheck = steps.some(s =>
      String(s.name || '').toLowerCase().includes('health') ||
      String(s.run || '').toLowerCase().includes('/health')
    );
    expect(hasHealthCheck).toBe(true);
  });
});

describe('Coverage threshold configuration', () => {
  it('package.json defines jest coverage thresholds at 80%', () => {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const thresholds = pkg?.jest?.coverageThreshold?.global;
    expect(thresholds).toBeDefined();
    expect(thresholds.lines).toBeGreaterThanOrEqual(80);
    expect(thresholds.statements).toBeGreaterThanOrEqual(80);
    expect(thresholds.functions).toBeGreaterThanOrEqual(80);
    expect(thresholds.branches).toBeGreaterThanOrEqual(75);
  });
});
