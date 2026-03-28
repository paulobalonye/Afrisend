# Contributing to AfriSend

## Git Workflow

### Branch Strategy

- `main` is the protected production branch. **Never push directly to main.**
- All work happens on feature branches.
- PRs are required to merge into `main`.

### Branch Naming

Use this format: `<type>/<HIT-number>-<short-description>`

Examples:
- `feat/HIT-42-yellowcard-adapter`
- `fix/HIT-48-flutterwave-security`
- `chore/HIT-59-ci-pipeline`

### Daily Workflow

1. **Create a feature branch** from `main`:
   ```bash
   git checkout main && git pull origin main
   git checkout -b feat/HIT-XX-description
   ```

2. **Commit and push frequently** (every 30 minutes while actively developing):
   ```bash
   git add <files>
   git commit -m "feat: description of change"
   git push origin feat/HIT-XX-description
   ```

3. **Create a PR** when your feature is ready for review:
   ```bash
   gh pr create --base main --title "feat: description" --body "## Summary\n- what changed\n\n## Test Plan\n- [ ] tests pass"
   ```

4. **Request review** from CTO or a senior engineer.

5. **Address review feedback**, then the reviewer merges.

### Commit Messages

Follow conventional commits:

```
<type>: <description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

### Code Review Requirements

- All PRs require at least 1 approving review before merge.
- CI must pass (lint, type-check, tests).
- The CTO or a designated senior engineer reviews PRs.
- Address all review comments before merging.

### CI Checks

Every PR automatically runs:
- **Lint** (`npm run lint`)
- **Type Check** (`npm run type-check`)
- **Unit Tests** (`npm run test:coverage`)

All checks must pass before merging.
