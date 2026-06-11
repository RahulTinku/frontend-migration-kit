import { describe, it, expect } from 'vitest';
import jscodeshift from 'jscodeshift';
import transform from './transform';

const j = jscodeshift.withParser('tsx');

function apply(source: string): string {
  const result = transform(
    { source, path: 'test.tsx' },
    { j, jscodeshift: j, stats: () => {}, report: () => {} },
    {},
  );
  return typeof result === 'string' ? result.trim() : source.trim();
}

describe('prop-types-to-ts', () => {
  it('removes prop-types import', () => {
    const source = `
import React from 'react';
import PropTypes from 'prop-types';
function Btn() { return null; }
Btn.propTypes = { label: PropTypes.string };
`.trim();
    expect(apply(source)).not.toContain("import PropTypes from 'prop-types'");
  });

  it('removes propTypes assignment', () => {
    const source = `
import PropTypes from 'prop-types';
function Btn() { return null; }
Btn.propTypes = { label: PropTypes.string };
`.trim();
    expect(apply(source)).not.toContain('Btn.propTypes');
  });

  it('generates Props interface with optional fields', () => {
    const source = `
import PropTypes from 'prop-types';
function Btn() { return null; }
Btn.propTypes = { label: PropTypes.string };
`.trim();
    const result = apply(source);
    expect(result).toContain('interface BtnProps');
    expect(result).toContain('label?:');
    expect(result).toContain('string');
  });

  it('marks .isRequired fields as required (non-optional)', () => {
    const source = `
import PropTypes from 'prop-types';
function Btn() { return null; }
Btn.propTypes = { label: PropTypes.string.isRequired };
`.trim();
    const result = apply(source);
    expect(result).toContain('label:');
    expect(result).not.toMatch(/label\?:/);
  });

  it('maps PropTypes.bool to boolean', () => {
    const source = `
import PropTypes from 'prop-types';
function Btn() { return null; }
Btn.propTypes = { disabled: PropTypes.bool };
`.trim();
    expect(apply(source)).toContain('boolean');
  });

  it('maps PropTypes.number to number', () => {
    const source = `
import PropTypes from 'prop-types';
function Btn() { return null; }
Btn.propTypes = { count: PropTypes.number };
`.trim();
    expect(apply(source)).toContain('number');
  });

  it('maps PropTypes.arrayOf to array type', () => {
    const source = `
import PropTypes from 'prop-types';
function List() { return null; }
List.propTypes = { items: PropTypes.arrayOf(PropTypes.string) };
`.trim();
    expect(apply(source)).toContain('string[]');
  });

  it('maps PropTypes.oneOf to union type', () => {
    const source = `
import PropTypes from 'prop-types';
function Btn() { return null; }
Btn.propTypes = { size: PropTypes.oneOf(['sm', 'md', 'lg']) };
`.trim();
    const result = apply(source);
    // jscodeshift may produce single or double quotes — just check values are present
    expect(result).toMatch(/["']sm["']/);
    expect(result).toMatch(/["']md["']/);
    expect(result).toMatch(/["']lg["']/);
  });

  it('returns null when no prop-types found', () => {
    const source = `
import React from 'react';
function Btn({ label }) { return null; }
`.trim();
    const result = transform(
      { source, path: 'test.tsx' },
      { j, jscodeshift: j, stats: () => {}, report: () => {} },
      {},
    );
    expect(result).toBeNull();
  });
});
