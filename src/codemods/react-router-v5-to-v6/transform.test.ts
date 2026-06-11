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

describe('react-router-v5-to-v6', () => {
  it('renames <Switch> to <Routes>', () => {
    const source = `
import { Switch, Route } from 'react-router-dom';
function App() {
  return <Switch><Route path="/home" /></Switch>;
}`.trim();
    const result = apply(source);
    expect(result).toContain('<Routes>');
    expect(result).toContain('</Routes>');
    expect(result).not.toContain('<Switch>');
  });

  it('renames <Redirect> to <Navigate> and adds replace prop', () => {
    const source = `
import { Redirect } from 'react-router-dom';
function App() { return <Redirect to="/home" />; }`.trim();
    const result = apply(source);
    expect(result).toContain('<Navigate');
    expect(result).toContain('replace');
    expect(result).not.toContain('<Redirect');
  });

  it('removes exact prop from <Route>', () => {
    const source = `
import { Route } from 'react-router-dom';
function App() { return <Route exact path="/home" />; }`.trim();
    const result = apply(source);
    expect(result).not.toContain('exact');
    expect(result).toContain('path="/home"');
  });

  it('converts component prop to element prop with JSX', () => {
    const source = `
import { Route } from 'react-router-dom';
function App() { return <Route path="/home" component={HomePage} />; }`.trim();
    const result = apply(source);
    expect(result).toContain('element={<HomePage />}');
    expect(result).not.toContain('component=');
  });

  it('renames useHistory to useNavigate', () => {
    const source = `
import { useHistory } from 'react-router-dom';
function Nav() {
  const history = useHistory();
  return null;
}`.trim();
    const result = apply(source);
    expect(result).toContain('useNavigate()');
    expect(result).not.toContain('useHistory()');
  });

  it('updates import specifiers', () => {
    const source = `import { Switch, Redirect, useHistory, Link } from 'react-router-dom';`;
    const result = apply(source);
    expect(result).toContain('Routes');
    expect(result).toContain('Navigate');
    expect(result).toContain('useNavigate');
    expect(result).toContain('Link'); // unchanged
    expect(result).not.toContain('Switch');
    expect(result).not.toContain('Redirect');
    expect(result).not.toContain('useHistory');
  });

  it('returns null when already v6', () => {
    const source = `
import { Routes, Route } from 'react-router-dom';
function App() { return <Routes><Route path="/home" element={<Home />} /></Routes>; }`.trim();
    const result = transform(
      { source, path: 'test.tsx' },
      { j, jscodeshift: j, stats: () => {}, report: () => {} },
      {},
    );
    expect(result).toBeNull();
  });
});
