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

describe('deprecated-react-apis', () => {
  it('renames componentWillMount to UNSAFE_componentWillMount', () => {
    const source = `
class MyComponent extends React.Component {
  componentWillMount() {
    this.setState({ ready: true });
  }
  render() { return null; }
}`.trim();
    const result = apply(source);
    expect(result).toContain('UNSAFE_componentWillMount');
    // Ensure the bare (unprefixed) name is gone
    expect(result).not.toMatch(/(?<!UNSAFE_)componentWillMount\(\)/);
  });

  it('renames componentWillReceiveProps to UNSAFE_componentWillReceiveProps', () => {
    const source = `
class MyComponent extends React.Component {
  componentWillReceiveProps(nextProps) {}
  render() { return null; }
}`.trim();
    expect(apply(source)).toContain('UNSAFE_componentWillReceiveProps');
  });

  it('renames componentWillUpdate to UNSAFE_componentWillUpdate', () => {
    const source = `
class MyComponent extends React.Component {
  componentWillUpdate(nextProps, nextState) {}
  render() { return null; }
}`.trim();
    expect(apply(source)).toContain('UNSAFE_componentWillUpdate');
  });

  it('renames all three in one component', () => {
    const source = `
class MyComponent extends React.Component {
  componentWillMount() {}
  componentWillReceiveProps(nextProps) {}
  componentWillUpdate(nextProps, nextState) {}
  render() { return null; }
}`.trim();
    const result = apply(source);
    expect(result).toContain('UNSAFE_componentWillMount');
    expect(result).toContain('UNSAFE_componentWillReceiveProps');
    expect(result).toContain('UNSAFE_componentWillUpdate');
  });

  it('preserves safe lifecycle methods unchanged', () => {
    const source = `
class MyComponent extends React.Component {
  componentDidMount() {}
  componentDidUpdate() {}
  componentWillUnmount() {}
  render() { return null; }
}`.trim();
    const result = apply(source);
    expect(result).toContain('componentDidMount');
    expect(result).toContain('componentDidUpdate');
    expect(result).toContain('componentWillUnmount');
    // Should be no-op — null means no changes
    const rawResult = transform(
      { source, path: 'test.js' },
      { j, jscodeshift: j, stats: () => {}, report: () => {} },
      {},
    );
    expect(rawResult).toBeNull();
  });

  it('handles arrow function class properties', () => {
    const source = `
class MyComponent extends React.Component {
  componentWillMount = () => {
    this.setState({ ready: true });
  }
  render() { return null; }
}`.trim();
    expect(apply(source)).toContain('UNSAFE_componentWillMount');
  });
});
