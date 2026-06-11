export interface CodemodMeta {
  name: string;
  description: string;
  tags: string[];
}

export const CODEMODS: CodemodMeta[] = [
  {
    name: 'react-class-to-hooks',
    description: 'Convert React class components to functional components with hooks',
    tags: ['react', 'hooks', 'modernize'],
  },
  {
    name: 'cjs-to-esm',
    description: 'Convert CommonJS require/module.exports to ESM import/export',
    tags: ['esm', 'modules', 'modernize'],
  },
  {
    name: 'prop-types-to-ts',
    description: 'Replace prop-types definitions with TypeScript interfaces',
    tags: ['typescript', 'types', 'react'],
  },
  {
    name: 'deprecated-react-apis',
    description: 'Fix deprecated React lifecycle methods and StrictMode incompatibilities',
    tags: ['react', 'deprecations'],
  },
  {
    name: 'react-router-v5-to-v6',
    description: 'Migrate React Router v5 APIs to v6 (Switch → Routes, Redirect → Navigate, etc.)',
    tags: ['react-router', 'migration'],
  },
  {
    name: 'enzyme-to-rtl',
    description: 'Convert Enzyme test utilities to React Testing Library equivalents',
    tags: ['testing', 'react-testing-library', 'enzyme'],
  },
];

export function listCodemods(): CodemodMeta[] {
  return CODEMODS;
}

export function findCodemod(name: string): CodemodMeta | undefined {
  return CODEMODS.find((c) => c.name === name);
}
