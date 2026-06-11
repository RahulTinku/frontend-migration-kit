# frontend-migration-kit

> A curated toolkit of production-tested codemods for common frontend migrations.

## Status
✅ 6 codemods · 46 tests · [npm](https://www.npmjs.com/package/frontend-migration-kit)

## What it is

An open-source package + CLI of battle-tested jscodeshift codemods for common frontend migrations. Covers React, TypeScript, and testing library upgrades that teams encounter when modernising legacy codebases.

## Included codemods

| Codemod | What it does |
|---------|-------------|
| `react-class-to-hooks` | React class components → functional components with hooks |
| `cjs-to-esm` | CommonJS `require` → ESM `import`/`export` |
| `prop-types-to-ts` | Prop-types → TypeScript interfaces |
| `deprecated-react-apis` | Lifecycle methods, StrictMode compatibility fixes |
| `react-router-v5-to-v6` | React Router v5 → v6 API changes |
| `enzyme-to-rtl` | Enzyme → React Testing Library |

## Install

```bash
npm install -g frontend-migration-kit
```

Or use without installing:

```bash
npx frontend-migration-kit run <codemod> <path>
```

## Usage

```bash
# List available codemods
migrate list

# Run a codemod on a file or directory
migrate run react-class-to-hooks src/

# Dry run (preview changes without writing)
migrate run cjs-to-esm src/ --dry

# Run on specific file extensions
migrate run prop-types-to-ts src/ --extensions ts,tsx
```

## Tech stack

- TypeScript + [jscodeshift](https://github.com/facebook/jscodeshift)
- [Vitest](https://vitest.dev) for codemod testing
- CLI with [commander](https://github.com/tj/commander.js)

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
