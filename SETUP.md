# PopQuiz Development Setup

## Installation

**Always use `npm ci` instead of `npm install`:**

```bash
npm ci
```

This ensures exact dependency versions across all machines.

## Why `npm ci`?

- `npm install` can update versions (bad for consistency)
- `npm ci` uses locked versions from `package-lock.json` (good for consistency)

## After Cloning

```bash
npm ci
npm run dev
```

## Never Manually Update Packages

If you need a new dependency or update:

```bash
npm install package-name --save-exact
git add package-lock.json package.json
git commit -m "Update: add/update package-name"
```

This updates `package-lock.json` which everyone syncs via Git.
