/**
 * Dockerfile validation tests — TDD (DevOps)
 *
 * Validates that Dockerfile.backend meets multi-stage build requirements:
 * - Multi-stage build with builder and production stages
 * - Uses Node.js 20 Alpine base
 * - Exposes correct port
 * - Production stage omits devDependencies
 * - Sets non-root user for security
 */

import * as fs from 'fs';
import * as path from 'path';

const DOCKERFILE_PATH = path.resolve(__dirname, '../../Dockerfile.backend');

function readDockerfile(): string {
  return fs.readFileSync(DOCKERFILE_PATH, 'utf-8');
}

function getFromInstructions(content: string): string[] {
  return content
    .split('\n')
    .filter(line => /^FROM\s/i.test(line.trim()))
    .map(line => line.trim());
}

function getStageNames(content: string): string[] {
  return getFromInstructions(content)
    .filter(line => /\bAS\b/i.test(line))
    .map(line => {
      const match = line.match(/\bAS\s+(\S+)/i);
      return match ? match[1].toLowerCase() : '';
    })
    .filter(Boolean);
}

describe('Dockerfile.backend', () => {
  let content: string;

  beforeAll(() => {
    content = readDockerfile();
  });

  it('exists at expected path', () => {
    expect(fs.existsSync(DOCKERFILE_PATH)).toBe(true);
  });

  it('uses Node.js 20 Alpine base image', () => {
    const fromLines = getFromInstructions(content);
    const hasNode20 = fromLines.some(line =>
      /node:20[.-]alpine/i.test(line)
    );
    expect(hasNode20).toBe(true);
  });

  it('is a multi-stage build (at least 2 FROM instructions)', () => {
    const fromLines = getFromInstructions(content);
    expect(fromLines.length).toBeGreaterThanOrEqual(2);
  });

  it('has a "builder" stage', () => {
    const stages = getStageNames(content);
    expect(stages).toContain('builder');
  });

  it('has a "production" or "runner" final stage', () => {
    const stages = getStageNames(content);
    const hasProductionStage = stages.some(s =>
      s === 'production' || s === 'runner' || s === 'prod'
    );
    expect(hasProductionStage).toBe(true);
  });

  it('exposes port 3000', () => {
    expect(content).toMatch(/^EXPOSE\s+3000/m);
  });

  it('sets a WORKDIR', () => {
    expect(content).toMatch(/^WORKDIR\s+/m);
  });

  it('includes a CMD or ENTRYPOINT instruction', () => {
    const hasCmdOrEntrypoint =
      /^CMD\s+/m.test(content) || /^ENTRYPOINT\s+/m.test(content);
    expect(hasCmdOrEntrypoint).toBe(true);
  });

  it('production stage copies compiled output from builder', () => {
    expect(content).toMatch(/COPY\s+--from=builder/i);
  });

  it('production stage installs only production dependencies (--omit=dev or --only=production)', () => {
    const prodInstallMatch =
      /npm ci.*--omit=dev|npm install.*--only=production|npm ci.*--production/i.test(content);
    expect(prodInstallMatch).toBe(true);
  });

  it('does not run as root — sets non-root USER', () => {
    expect(content).toMatch(/^USER\s+/m);
    // Should not be running as root (uid 0)
    const userLines = content
      .split('\n')
      .filter(line => /^USER\s+/m.test(line.trim()));
    const runsAsRoot = userLines.some(line => /USER\s+root/i.test(line));
    expect(runsAsRoot).toBe(false);
  });
});
