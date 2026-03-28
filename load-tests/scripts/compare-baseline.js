#!/usr/bin/env node
/**
 * Performance Regression Checker
 *
 * Compares a k6 summary output (load-tests/reports/slo-results.json)
 * against the performance baseline (load-tests/baselines/performance-baseline.json).
 *
 * Exits with code 1 if any SLO is breached beyond the tolerance thresholds.
 * Prints a clear report for CI logs.
 *
 * Usage:
 *   node load-tests/scripts/compare-baseline.js
 *   node load-tests/scripts/compare-baseline.js --results path/to/slo-results.json
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

function parseArgs() {
  const args = process.argv.slice(2);
  const resultsIdx = args.indexOf('--results');
  return {
    resultsPath:
      resultsIdx !== -1
        ? path.resolve(args[resultsIdx + 1])
        : path.join(ROOT, 'load-tests/reports/slo-results.json'),
    baselinePath: path.join(ROOT, 'load-tests/baselines/performance-baseline.json'),
  };
}

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function pct(value, baseline) {
  if (baseline === 0) return 0;
  return ((value - baseline) / baseline) * 100;
}

function checkThreshold(name, actual, baseline, tolerancePct, unit = 'ms', lowerIsBetter = true) {
  if (actual === null || actual === undefined) {
    return { name, status: 'SKIP', message: `No data for ${name}` };
  }

  const degradation = lowerIsBetter ? pct(actual, baseline) : pct(baseline, actual);
  const passed = degradation <= tolerancePct;

  return {
    name,
    status: passed ? 'PASS' : 'FAIL',
    actual: `${typeof actual === 'number' ? actual.toFixed(1) : actual}${unit}`,
    baseline: `${baseline}${unit}`,
    degradation: `${degradation.toFixed(1)}%`,
    tolerance: `${tolerancePct}%`,
    message: passed
      ? `OK (+${degradation.toFixed(1)}% vs baseline)`
      : `REGRESSION: ${name} is ${degradation.toFixed(1)}% worse than baseline (tolerance: ${tolerancePct}%)`,
  };
}

function main() {
  const { resultsPath, baselinePath } = parseArgs();

  let results, baseline;
  try {
    results = loadJson(resultsPath);
    baseline = loadJson(baselinePath);
  } catch (err) {
    console.error(`Error loading files: ${err.message}`);
    process.exit(2);
  }

  const slo = results.slo || {};
  const b = baseline.slos;
  const tolerances = baseline.regression_tolerances;
  const p95Tol = tolerances.p95_degradation_pct;
  const p99Tol = tolerances.p99_degradation_pct;
  const successTol = tolerances.success_rate_drop_pct;

  const checks = [
    // Transaction
    checkThreshold(
      'transaction p95',
      slo.transaction_initiation_p95_ms,
      b.transaction_initiation.p95_ms,
      p95Tol
    ),
    checkThreshold(
      'transaction p99',
      slo.transaction_initiation_p99_ms,
      b.transaction_initiation.p99_ms,
      p99Tol
    ),
    checkThreshold(
      'transaction success rate',
      slo.transaction_success_rate != null ? slo.transaction_success_rate * 100 : null,
      b.transaction_initiation.success_rate_min * 100,
      successTol,
      '%',
      false // higher is better
    ),

    // FX quote
    checkThreshold('fx_quote p95', slo.fx_quote_p95_ms, b.fx_quote_creation.p95_ms, p95Tol),
    checkThreshold('fx_quote p99', slo.fx_quote_p99_ms, b.fx_quote_creation.p99_ms, p99Tol),
    checkThreshold('fx_rate_fetch p99', slo.fx_rate_fetch_p99_ms, b.fx_rate_fetch.p99_ms, p99Tol),
    checkThreshold(
      'fx success rate',
      slo.fx_success_rate != null ? slo.fx_success_rate * 100 : null,
      b.fx_quote_creation.success_rate_min * 100,
      successTol,
      '%',
      false
    ),

    // KYC
    checkThreshold('kyc_submit p95', slo.kyc_submit_p95_ms, b.kyc_submit.p95_ms, p95Tol),
    checkThreshold('kyc_submit p99', slo.kyc_submit_p99_ms, b.kyc_submit.p99_ms, p99Tol),
    checkThreshold(
      'kyc success rate',
      slo.kyc_success_rate != null ? slo.kyc_success_rate * 100 : null,
      b.kyc_submit.success_rate_min * 100,
      successTol,
      '%',
      false
    ),

    // Global error rate
    checkThreshold(
      'global http error rate',
      slo.global_http_error_rate != null ? slo.global_http_error_rate * 100 : null,
      baseline.global.http_error_rate_max * 100,
      p95Tol,
      '%'
    ),
  ];

  // ── Print report ─────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║         AfriSend Performance Regression Report               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`Results:  ${resultsPath}`);
  console.log(`Baseline: ${baselinePath}`);
  console.log(`Run at:   ${results.runAt || 'unknown'}\n`);

  const failures = [];

  for (const check of checks) {
    if (check.status === 'SKIP') {
      console.log(`  SKIP  ${check.name} — ${check.message}`);
    } else if (check.status === 'PASS') {
      console.log(`  PASS  ${check.name}: ${check.actual} vs baseline ${check.baseline} (${check.message})`);
    } else {
      console.log(`  FAIL  ${check.name}: ${check.actual} vs baseline ${check.baseline} — ${check.message}`);
      failures.push(check);
    }
  }

  console.log('\n─────────────────────────────────────────────────────────────\n');

  if (failures.length === 0) {
    console.log('Result: ALL SLOs WITHIN BASELINE TOLERANCE ✓\n');
    process.exit(0);
  } else {
    console.log(`Result: ${failures.length} SLO REGRESSION(S) DETECTED ✗\n`);
    for (const f of failures) {
      console.log(`  → ${f.message}`);
    }
    console.log('');
    process.exit(1);
  }
}

main();
