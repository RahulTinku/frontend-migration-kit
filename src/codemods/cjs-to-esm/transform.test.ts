import { describe, it, expect } from 'vitest';
import jscodeshift from 'jscodeshift';
import transform from './transform';

const j = jscodeshift.withParser('babel');

function apply(source: string): string {
  const result = transform(
    { source, path: 'test.js' },
    { j, jscodeshift: j, stats: () => {}, report: () => {} },
    {},
  );
  return typeof result === 'string' ? result.trim() : source.trim();
}

describe('cjs-to-esm', () => {
  // ── require → import ────────────────────────────────────────────────────

  it('converts default require to default import', () => {
    expect(apply("const foo = require('foo');")).toBe("import foo from 'foo';");
  });

  it('converts destructured require to named imports', () => {
    expect(apply("const { a, b } = require('bar');")).toBe("import { a, b } from 'bar';");
  });

  it('converts renamed destructure to aliased import', () => {
    expect(apply("const { foo: myFoo } = require('baz');")).toBe("import { foo as myFoo } from 'baz';");
  });

  it('handles relative paths', () => {
    expect(apply("const utils = require('./utils');")).toBe("import utils from './utils';");
  });

  // ── module.exports ────────────────────────────────────────────────────────

  it('converts module.exports = X to export default', () => {
    expect(apply('module.exports = MyClass;')).toBe('export default MyClass;');
  });

  it('converts module.exports = { a, b } to named exports', () => {
    expect(apply('module.exports = { a, b };')).toBe('export { a, b };');
  });

  // ── no-op ─────────────────────────────────────────────────────────────────

  it('returns null when source is already ESM (no changes)', () => {
    const source = "import foo from 'foo';";
    const result = transform(
      { source, path: 'test.js' },
      { j, jscodeshift: j, stats: () => {}, report: () => {} },
      {},
    );
    expect(result).toBeNull();
  });

  // ── multi-line ────────────────────────────────────────────────────────────

  it('converts multiple requires in one file', () => {
    const source = [
      "const React = require('react');",
      "const { useState, useEffect } = require('react');",
      'module.exports = App;',
    ].join('\n');

    const result = apply(source);
    expect(result).toContain("import React from 'react'");
    expect(result).toContain("import { useState, useEffect } from 'react'");
    expect(result).toContain('export default App');
  });
});
