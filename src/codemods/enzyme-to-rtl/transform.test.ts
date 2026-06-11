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

describe('enzyme-to-rtl', () => {
  it('replaces enzyme import with @testing-library/react', () => {
    const source = `import { shallow } from 'enzyme';`;
    const result = apply(source);
    expect(result).toContain('@testing-library/react');
    expect(result).not.toContain("from 'enzyme'");
    expect(result).not.toContain('from "enzyme"');
  });

  it('imports render, screen, and fireEvent from RTL', () => {
    const source = `import { shallow, mount } from 'enzyme';`;
    const result = apply(source);
    expect(result).toContain('render');
    expect(result).toContain('screen');
    expect(result).toContain('fireEvent');
  });

  it('converts shallow() to render()', () => {
    const source = `
import { shallow } from 'enzyme';
const wrapper = shallow(<Button />);`.trim();
    const result = apply(source);
    expect(result).toContain('render(<Button />)');
    expect(result).not.toContain('shallow(');
  });

  it('converts mount() to render()', () => {
    const source = `
import { mount } from 'enzyme';
const wrapper = mount(<Form />);`.trim();
    const result = apply(source);
    expect(result).toContain('render(<Form />)');
    expect(result).not.toContain('mount(');
  });

  it('converts wrapper.simulate(click) to fireEvent.click()', () => {
    const source = `
import { shallow } from 'enzyme';
const wrapper = shallow(<Btn />);
wrapper.simulate('click');`.trim();
    const result = apply(source);
    expect(result).toContain('fireEvent.click');
    expect(result).not.toContain('.simulate(');
  });

  it('adds TODO comment for wrapper.find()', () => {
    const source = `
import { shallow } from 'enzyme';
const wrapper = shallow(<Form />);
wrapper.find('input');`.trim();
    const result = apply(source);
    expect(result).toContain('TODO(enzyme-to-rtl)');
    expect(result).toContain('.find(');
  });

  it('adds TODO comment for wrapper.text()', () => {
    const source = `
import { mount } from 'enzyme';
const wrapper = mount(<Title />);
const text = wrapper.text();`.trim();
    const result = apply(source);
    expect(result).toContain('TODO(enzyme-to-rtl)');
  });

  it('returns null when no enzyme imports found', () => {
    const source = `import { render, screen } from '@testing-library/react';`;
    const result = transform(
      { source, path: 'test.tsx' },
      { j, jscodeshift: j, stats: () => {}, report: () => {} },
      {},
    );
    expect(result).toBeNull();
  });
});
