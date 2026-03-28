#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AfriSend Load Test Runner
#
# Runs the k6 load test suite and optionally compares results against baseline.
#
# Usage:
#   ./load-tests/scripts/run-load-tests.sh [scenario] [options]
#
#   Scenarios:
#     full          Run full suite (default)
#     transactions  Transaction load only
#     fx            FX quote load only
#     kyc           KYC throughput only
#     rate-limits   Rate limiting validation (requires Kong)
#
#   Options:
#     --url <url>         Override API base URL (default: http://localhost:3000)
#     --gateway <url>     Kong gateway URL (default: http://localhost:8000)
#     --no-baseline       Skip baseline comparison
#     --ci                CI mode: fail fast on SLO breach
#     --out json          Output format (json, csv, influxdb)
#
# Examples:
#   ./load-tests/scripts/run-load-tests.sh full --url http://staging.afrisend.com
#   ./load-tests/scripts/run-load-tests.sh transactions --ci
#   ./load-tests/scripts/run-load-tests.sh fx --no-baseline
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LOAD_TESTS_DIR="${ROOT_DIR}/load-tests"
REPORTS_DIR="${LOAD_TESTS_DIR}/reports"

# ── Defaults ──────────────────────────────────────────────────────────────────
SCENARIO="full"
BASE_URL="${K6_BASE_URL:-http://localhost:3000}"
GATEWAY_URL="${K6_GATEWAY_URL:-http://localhost:8000}"
COMPARE_BASELINE=true
CI_MODE=false
OUTPUT_FORMAT="json"

# ── Parse arguments ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    full|transactions|fx|kyc|rate-limits)
      SCENARIO="$1"
      shift
      ;;
    --url)
      BASE_URL="$2"
      shift 2
      ;;
    --gateway)
      GATEWAY_URL="$2"
      shift 2
      ;;
    --no-baseline)
      COMPARE_BASELINE=false
      shift
      ;;
    --ci)
      CI_MODE=true
      shift
      ;;
    --out)
      OUTPUT_FORMAT="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# ── Validate k6 is installed ──────────────────────────────────────────────────
if ! command -v k6 &>/dev/null; then
  echo "ERROR: k6 is not installed."
  echo ""
  echo "Install k6:"
  echo "  macOS:  brew install k6"
  echo "  Linux:  sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69"
  echo "          echo 'deb https://dl.k6.io/deb stable main' | sudo tee /etc/apt/sources.list.d/k6.list"
  echo "          sudo apt-get update && sudo apt-get install k6"
  echo "  Docker: docker pull grafana/k6"
  echo ""
  exit 1
fi

# ── Ensure reports directory exists ──────────────────────────────────────────
mkdir -p "${REPORTS_DIR}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# ── Map scenario to k6 script ─────────────────────────────────────────────────
case "$SCENARIO" in
  full)
    SCRIPT="${LOAD_TESTS_DIR}/k6/full-suite.js"
    REPORT_FILE="${REPORTS_DIR}/full-suite-${TIMESTAMP}.json"
    ;;
  transactions)
    SCRIPT="${LOAD_TESTS_DIR}/k6/scenarios/transaction-load.js"
    REPORT_FILE="${REPORTS_DIR}/transactions-${TIMESTAMP}.json"
    ;;
  fx)
    SCRIPT="${LOAD_TESTS_DIR}/k6/scenarios/fx-quotes-load.js"
    REPORT_FILE="${REPORTS_DIR}/fx-${TIMESTAMP}.json"
    ;;
  kyc)
    SCRIPT="${LOAD_TESTS_DIR}/k6/scenarios/kyc-throughput.js"
    REPORT_FILE="${REPORTS_DIR}/kyc-${TIMESTAMP}.json"
    ;;
  rate-limits)
    SCRIPT="${LOAD_TESTS_DIR}/k6/scenarios/rate-limiting.js"
    REPORT_FILE="${REPORTS_DIR}/rate-limits-${TIMESTAMP}.json"
    BASE_URL="${GATEWAY_URL}"  # Rate limit tests hit Kong directly
    ;;
esac

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              AfriSend Load Test Runner                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Scenario:   ${SCENARIO}"
echo "Target URL: ${BASE_URL}"
echo "Script:     ${SCRIPT}"
echo "Report:     ${REPORT_FILE}"
echo "CI mode:    ${CI_MODE}"
echo ""

# ── Run k6 ────────────────────────────────────────────────────────────────────
K6_ARGS=(
  "run"
  "--env" "K6_BASE_URL=${BASE_URL}"
  "--env" "K6_GATEWAY_URL=${GATEWAY_URL}"
  "--summary-export" "${REPORT_FILE}"
)

if [[ "${OUTPUT_FORMAT}" == "json" ]]; then
  K6_ARGS+=("--out" "json=${REPORTS_DIR}/raw-metrics-${TIMESTAMP}.json.gz")
fi

if [[ "${CI_MODE}" == "true" ]]; then
  K6_ARGS+=("--no-color")
fi

K6_ARGS+=("${SCRIPT}")

echo "Running: k6 ${K6_ARGS[*]}"
echo ""

k6 "${K6_ARGS[@]}"
K6_EXIT_CODE=$?

echo ""
echo "k6 exit code: ${K6_EXIT_CODE}"

# ── Baseline comparison ───────────────────────────────────────────────────────
if [[ "${COMPARE_BASELINE}" == "true" ]] && [[ -f "${REPORTS_DIR}/slo-results.json" ]]; then
  echo ""
  echo "Running baseline comparison..."
  node "${LOAD_TESTS_DIR}/scripts/compare-baseline.js" --results "${REPORTS_DIR}/slo-results.json"
  COMPARE_EXIT_CODE=$?
else
  COMPARE_EXIT_CODE=0
fi

# ── Final result ──────────────────────────────────────────────────────────────
echo ""
if [[ "${K6_EXIT_CODE}" -ne 0 ]]; then
  echo "RESULT: Load test FAILED (k6 threshold violations detected)"
  exit 1
elif [[ "${COMPARE_EXIT_CODE}" -ne 0 ]]; then
  echo "RESULT: Load test FAILED (performance regression detected)"
  exit 1
else
  echo "RESULT: Load test PASSED ✓"
  exit 0
fi
