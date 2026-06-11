import type { Transform } from 'jscodeshift';

/**
 * react-router-v5-to-v6
 *
 * Migrates React Router v5 APIs to v6.
 *
 * JSX changes:
 *   <Switch>         → <Routes>
 *   <Redirect to="X" />  → <Navigate to="X" replace />
 *   <Route exact>    → <Route>  (exact removed; all routes exact in v6)
 *   <Route component={X}>  → <Route element={<X />}>
 *   <Route render={() => <X />}>  → <Route element={<X />}>
 *
 * Hook changes:
 *   useHistory()     → useNavigate()
 *
 * Import changes:
 *   Switch  → Routes
 *   Redirect → Navigate
 *   useHistory → useNavigate
 */

const V5_TO_V6_NAMES: Record<string, string> = {
  Switch: 'Routes',
  Redirect: 'Navigate',
  useHistory: 'useNavigate',
};

const transform: Transform = (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);
  let changed = false;

  // ── Rename JSX elements: <Switch> → <Routes>, <Redirect> → <Navigate> ──────
  const jsxNames = ['Switch', 'Redirect'];
  for (const oldName of jsxNames) {
    const newName = V5_TO_V6_NAMES[oldName];

    root.find(j.JSXOpeningElement, { name: { type: 'JSXIdentifier', name: oldName } })
      .forEach((p) => { (p.node.name as any).name = newName; changed = true; });

    root.find(j.JSXClosingElement, { name: { type: 'JSXIdentifier', name: oldName } })
      .forEach((p) => { (p.node.name as any).name = newName; changed = true; });
  }

  // ── <Navigate> needs replace prop ──────────────────────────────────────────
  root.find(j.JSXOpeningElement, { name: { type: 'JSXIdentifier', name: 'Navigate' } })
    .forEach((p) => {
      const hasReplace = p.node.attributes.some(
        (a) => a.type === 'JSXAttribute' && (a.name as any).name === 'replace',
      );
      if (!hasReplace) {
        p.node.attributes.push(j.jsxAttribute(j.jsxIdentifier('replace')));
        changed = true;
      }
    });

  // ── Remove exact prop from <Route> ─────────────────────────────────────────
  root.find(j.JSXOpeningElement, { name: { type: 'JSXIdentifier', name: 'Route' } })
    .forEach((p) => {
      const before = p.node.attributes.length;
      p.node.attributes = p.node.attributes.filter(
        (a) => !(a.type === 'JSXAttribute' && (a.name as any).name === 'exact'),
      );
      if (p.node.attributes.length !== before) changed = true;
    });

  // ── <Route component={X}> → <Route element={<X />}> ─────────────────────
  root.find(j.JSXOpeningElement, { name: { type: 'JSXIdentifier', name: 'Route' } })
    .forEach((p) => {
      p.node.attributes = p.node.attributes.map((attr) => {
        if (attr.type !== 'JSXAttribute') return attr;
        const attrName = (attr.name as any).name;

        if (attrName === 'component' && attr.value) {
          // component={X} → element={<X />}
          const val = (attr.value as any).expression;
          const elementVal = j.jsxExpressionContainer(
            j.jsxElement(
              j.jsxOpeningElement(j.jsxIdentifier(val.name ?? 'Component'), [], true),
              null,
              [],
            ),
          );
          changed = true;
          return j.jsxAttribute(j.jsxIdentifier('element'), elementVal);
        }

        if (attrName === 'render' && attr.value) {
          // render={() => <X />} → element={<X />}
          const fn = (attr.value as any).expression;
          let elementNode: any = null;
          if (fn.type === 'ArrowFunctionExpression') {
            const body = fn.body;
            if (body.type === 'JSXElement') elementNode = body;
            else if (body.type === 'BlockStatement') {
              const ret = body.body.find((s: any) => s.type === 'ReturnStatement');
              if (ret?.argument?.type === 'JSXElement') elementNode = ret.argument;
            }
          }
          if (elementNode) {
            changed = true;
            return j.jsxAttribute(j.jsxIdentifier('element'), j.jsxExpressionContainer(elementNode));
          }
        }

        return attr;
      });
    });

  // ── useHistory → useNavigate call sites ────────────────────────────────────
  root.find(j.CallExpression, {
    callee: { type: 'Identifier', name: 'useHistory' },
  }).forEach((p) => {
    (p.node.callee as any).name = 'useNavigate';
    changed = true;
  });

  // ── Update import specifiers from react-router-dom ─────────────────────────
  root.find(j.ImportDeclaration).forEach((p) => {
    const src = (p.node.source as any).value as string;
    if (src !== 'react-router-dom' && src !== 'react-router') return;

    p.node.specifiers = (p.node.specifiers ?? []).map((spec) => {
      if (spec.type !== 'ImportSpecifier') return spec;
      const imported = (spec.imported as any).name as string;
      const newName = V5_TO_V6_NAMES[imported];
      if (newName) {
        changed = true;
        const local = (spec.local as any).name;
        const newSpec = j.importSpecifier(j.identifier(newName));
        // If local was aliased differently, keep alias
        if (local !== imported) (newSpec as any).local = j.identifier(local);
        return newSpec;
      }
      return spec;
    });
  });

  if (!changed) return null;
  return root.toSource();
};

export default transform;
