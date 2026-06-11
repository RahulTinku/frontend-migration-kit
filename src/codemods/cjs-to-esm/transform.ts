import type { Transform, ASTPath, VariableDeclaration } from 'jscodeshift';

/**
 * cjs-to-esm
 *
 * Converts CommonJS module syntax to ES module syntax.
 *
 * Handles:
 *   const x = require('foo')           → import x from 'foo'
 *   const { a, b } = require('foo')    → import { a, b } from 'foo'
 *   const { a: b } = require('foo')    → import { a as b } from 'foo'
 *   module.exports = X                 → export default X
 *   module.exports = { a, b }          → export { a, b }
 */
const transform: Transform = (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);
  let changed = false;

  // ── require() → import ────────────────────────────────────────────────────
  root.find(j.VariableDeclaration).forEach((path: ASTPath<VariableDeclaration>) => {
    const { declarations } = path.node;
    if (declarations.length !== 1) return;

    const decl = declarations[0];
    if (decl.type !== 'VariableDeclarator' || !decl.init) return;

    const { init } = decl;
    if (
      init.type !== 'CallExpression' ||
      init.callee.type !== 'Identifier' ||
      (init.callee as any).name !== 'require' ||
      init.arguments.length !== 1
    ) return;

    const sourceArg = init.arguments[0] as any;
    if (sourceArg.type !== 'StringLiteral' && sourceArg.type !== 'Literal') return;
    const sourcePath: string = sourceArg.value;

    let importDecl = null;

    if (decl.id.type === 'Identifier') {
      // const x = require('foo') → import x from 'foo'
      importDecl = j.importDeclaration(
        [j.importDefaultSpecifier(j.identifier(decl.id.name))],
        j.literal(sourcePath),
      );
    } else if (decl.id.type === 'ObjectPattern') {
      // const { a, b } = require('foo') → import { a, b } from 'foo'
      const specifiers: any[] = [];
      let valid = true;

      for (const prop of (decl.id as any).properties) {
        if (prop.type === 'RestElement' || prop.type === 'RestProperty') {
          valid = false;
          break;
        }
        const key: string = (prop.key as any).name;
        const value: string =
          prop.value?.type === 'Identifier' ? (prop.value as any).name : key;
        if (!key) { valid = false; break; }

        specifiers.push(
          key === value
            ? j.importSpecifier(j.identifier(key))
            : j.importSpecifier(j.identifier(key), j.identifier(value)),
        );
      }

      if (valid && specifiers.length > 0) {
        importDecl = j.importDeclaration(specifiers, j.literal(sourcePath));
      }
    }

    if (importDecl) {
      j(path).replaceWith(importDecl);
      changed = true;
    }
  });

  // ── module.exports = { a, b } → export { a, b } ───────────────────────────
  root.find(j.AssignmentExpression, {
    left: {
      type: 'MemberExpression',
      object: { type: 'Identifier', name: 'module' },
      property: { type: 'Identifier', name: 'exports' },
    },
  })
    .filter((path) => path.parent.node.type === 'ExpressionStatement')
    .forEach((path) => {
      const rhs = path.node.right;

      if (rhs.type === 'ObjectExpression' && (rhs as any).properties.every(
        (p: any) => (p.type === 'ObjectProperty' || p.type === 'Property') &&
          !p.computed && p.key.type === 'Identifier' && p.shorthand,
      )) {
        // module.exports = { a, b } → export { a, b }
        const specifiers = (rhs as any).properties.map((p: any) =>
          j.exportSpecifier.from({ local: j.identifier(p.key.name), exported: j.identifier(p.key.name) }),
        );
        j(path.parent).replaceWith(j.exportNamedDeclaration(null, specifiers));
      } else {
        // module.exports = X → export default X
        j(path.parent).replaceWith(j.exportDefaultDeclaration(rhs));
      }
      changed = true;
    });

  if (!changed) return null;
  return root.toSource({ quote: 'single' });
};

export default transform;
