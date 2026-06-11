import type { Transform } from 'jscodeshift';

/**
 * enzyme-to-rtl
 *
 * Migrates Enzyme test utilities to React Testing Library.
 *
 * Handles:
 *   Imports:
 *     import { shallow, mount } from 'enzyme'
 *       → import { render, screen, fireEvent } from '@testing-library/react'
 *
 *   Render calls:
 *     shallow(<X />) → render(<X />)
 *     mount(<X />)   → render(<X />)
 *
 *   Wrapper method calls that cannot be auto-migrated are annotated with
 *   // TODO(enzyme-to-rtl): ... comments so the developer knows exactly
 *   what needs manual attention.
 *
 * NOTE: Enzyme's imperative wrapper API (wrapper.find, wrapper.text,
 * wrapper.simulate) does not map 1:1 to RTL's query-first API. These
 * sites are flagged with TODO comments for manual migration.
 */

/** Enzyme methods that need manual migration */
const MANUAL_MIGRATION_METHODS = new Set([
  'find', 'findWhere', 'filter', 'filterWhere',
  'contains', 'containsMatchingElement',
  'text', 'html', 'debug',
  'props', 'prop', 'state', 'instance',
  'setProps', 'setState',
  'update', 'unmount',
  'invoke',
]);

/** Enzyme methods that map cleanly to fireEvent */
const SIMULATE_TO_FIRE_EVENT: Record<string, string> = {
  click: 'click',
  change: 'change',
  submit: 'submit',
  focus: 'focus',
  blur: 'blur',
  keyDown: 'keyDown',
  keyUp: 'keyUp',
  mouseEnter: 'mouseEnter',
  mouseLeave: 'mouseLeave',
};

const transform: Transform = (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);
  let changed = false;

  // Track which enzyme symbols are imported
  const importedFromEnzyme = new Set<string>();

  // ── Replace enzyme import ──────────────────────────────────────────────────
  root.find(j.ImportDeclaration).forEach((p) => {
    const src = (p.node.source as any).value as string;
    if (src !== 'enzyme') return;

    for (const spec of p.node.specifiers ?? []) {
      if (spec.type === 'ImportSpecifier') {
        importedFromEnzyme.add((spec.imported as any).name);
      }
    }

    // Replace with @testing-library/react import
    j(p).replaceWith(
      j.importDeclaration(
        [
          j.importSpecifier(j.identifier('render')),
          j.importSpecifier(j.identifier('screen')),
          j.importSpecifier(j.identifier('fireEvent')),
        ],
        j.literal('@testing-library/react'),
      ),
    );
    changed = true;
  });

  if (importedFromEnzyme.size === 0) return null;

  // ── shallow(<X />) / mount(<X />) → render(<X />) ─────────────────────────
  for (const enzymeFn of ['shallow', 'mount']) {
    if (!importedFromEnzyme.has(enzymeFn)) continue;

    root.find(j.CallExpression, {
      callee: { type: 'Identifier', name: enzymeFn },
    }).forEach((p) => {
      (p.node.callee as any).name = 'render';
      changed = true;
    });
  }

  // ── wrapper.simulate('click') → fireEvent.click(element) ──────────────────
  root.find(j.CallExpression, {
    callee: {
      type: 'MemberExpression',
      property: { type: 'Identifier', name: 'simulate' },
    },
  }).forEach((p) => {
    const eventArg = p.node.arguments[0] as any;
    const eventName: string = eventArg?.value ?? '';
    const fireEventMethod = SIMULATE_TO_FIRE_EVENT[eventName];

    if (fireEventMethod) {
      // Replace: wrapper.simulate('click') → fireEvent.click(wrapper)
      const wrapperExpr = (p.node.callee as any).object;
      j(p).replaceWith(
        j.callExpression(
          j.memberExpression(j.identifier('fireEvent'), j.identifier(fireEventMethod)),
          [wrapperExpr, ...p.node.arguments.slice(1)],
        ),
      );
    } else {
      // Unknown event — add comment
      addTodoComment(j, p, `migrate simulate('${eventName}') to fireEvent`);
    }
    changed = true;
  });

  // ── wrapper.method() → add TODO comments ─────────────────────────────────
  root.find(j.CallExpression, {
    callee: { type: 'MemberExpression' },
  }).forEach((p) => {
    const callee = p.node.callee as any;
    if (callee.property?.type !== 'Identifier') return;
    const methodName: string = callee.property.name;

    if (MANUAL_MIGRATION_METHODS.has(methodName)) {
      addTodoComment(j, p, `migrate .${methodName}() to @testing-library/react query`);
      changed = true;
    }
  });

  if (!changed) return null;
  return root.toSource();
};

function addTodoComment(j: any, path: any, message: string): void {
  const parentStatement = path.parent?.node;
  if (!parentStatement?.leadingComments) {
    if (parentStatement) {
      parentStatement.comments = parentStatement.comments ?? [];
      parentStatement.comments.push(
        j.commentLine(` TODO(enzyme-to-rtl): ${message}`, true, false),
      );
    }
  }
}

export default transform;
