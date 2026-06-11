# frontend-migration-kit

> A curated toolkit of production-tested codemods for common frontend migrations.

## Status
✅ 6 codemods · 46 tests · [npm](https://www.npmjs.com/package/frontend-migration-kit)

## What it is

An open-source package + CLI of battle-tested jscodeshift codemods for common frontend migrations. Covers React, TypeScript, and testing library upgrades that teams encounter when modernising legacy codebases.

## Included codemods

| Codemod | What it does |
|---------|-------------|
| `react-class-to-hooks` | Converts React class components to functional components with `useState` and `useEffect` |
| `cjs-to-esm` | Converts `require()`/`module.exports` to ES module `import`/`export` syntax |
| `prop-types-to-ts` | Removes `prop-types` declarations and generates equivalent TypeScript interfaces |
| `deprecated-react-apis` | Renames deprecated lifecycle methods (`componentWillMount` etc.) to their `UNSAFE_` equivalents |
| `react-router-v5-to-v6` | Migrates `Switch`→`Routes`, `Redirect`→`Navigate`, `useHistory`→`useNavigate`, and removes `exact` |
| `enzyme-to-rtl` | Replaces Enzyme imports and `shallow`/`mount` calls with `@testing-library/react` equivalents |

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
