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

describe('react-class-to-hooks', () => {
  it('converts a stateless class component to an arrow function', () => {
    const source = `
import React from 'react';
class Greeting extends React.Component {
  render() {
    return <h1>Hello</h1>;
  }
}`.trim();
    const result = apply(source);
    expect(result).toContain('const Greeting =');
    expect(result).not.toContain('class Greeting');
    expect(result).toContain('<h1>Hello</h1>');
  });

  it('replaces this.props.X with props.X', () => {
    const source = `
import React from 'react';
class Greeting extends React.Component {
  render() {
    return <h1>{this.props.name}</h1>;
  }
}`.trim();
    const result = apply(source);
    expect(result).toContain('props.name');
    expect(result).not.toContain('this.props');
  });

  it('converts state to useState', () => {
    const source = `
import React from 'react';
class Counter extends React.Component {
  constructor(props) {
    super(props);
    this.state = { count: 0 };
  }
  render() {
    return <span>{this.state.count}</span>;
  }
}`.trim();
    const result = apply(source);
    expect(result).toContain('useState(0)');
    expect(result).toContain('count');
    expect(result).not.toContain('this.state');
  });

  it('converts this.setState to setter', () => {
    const source = `
import React from 'react';
class Counter extends React.Component {
  constructor(props) {
    super(props);
    this.state = { count: 0 };
  }
  render() {
    return <button onClick={() => this.setState({ count: 1 })}>Click</button>;
  }
}`.trim();
    const result = apply(source);
    expect(result).toContain('setCount(1)');
    expect(result).not.toContain('this.setState');
  });

  it('converts componentDidMount to useEffect with empty deps', () => {
    const source = `
import React from 'react';
class DataLoader extends React.Component {
  componentDidMount() {
    fetchData();
  }
  render() {
    return <div />;
  }
}`.trim();
    const result = apply(source);
    expect(result).toContain('useEffect(');
    expect(result).toContain('fetchData()');
    expect(result).toContain('[]');
  });

  it('adds useState and useEffect imports to existing react import', () => {
    const source = `
import React from 'react';
class Counter extends React.Component {
  constructor(props) {
    super(props);
    this.state = { count: 0 };
  }
  componentDidMount() { fetchData(); }
  render() { return <div>{this.state.count}</div>; }
}`.trim();
    const result = apply(source);
    expect(result).toContain('useState');
    expect(result).toContain('useEffect');
  });

  it('skips components with unsupported lifecycle methods and adds TODO', () => {
    const source = `
import React from 'react';
class Complex extends React.Component {
  shouldComponentUpdate() { return true; }
  render() { return <div />; }
}`.trim();
    const result = apply(source);
    expect(result).toContain('TODO(react-class-to-hooks)');
  });

  it('returns null for non-class files', () => {
    const source = `const Foo = () => <div />;`;
    const result = transform(
      { source, path: 'test.tsx' },
      { j, jscodeshift: j, stats: () => {}, report: () => {} },
      {},
    );
    expect(result).toBeNull();
  });
});
