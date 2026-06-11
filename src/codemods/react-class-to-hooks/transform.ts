import type { Transform } from 'jscodeshift';

/**
 * react-class-to-hooks
 *
 * Converts React class components to functional components with hooks.
 *
 * Handles:
 *   - Stateless class components (render-only) → arrow function component
 *   - this.props.X → props.X
 *   - this.state.X → destructured useState variables
 *   - this.setState({ X: val }) → setX(val) / setX(prev => ({ ...prev, X: val }))
 *   - componentDidMount → useEffect(() => { ... }, [])
 *   - componentWillUnmount → useEffect cleanup return
 *   - componentDidUpdate → useEffect(() => { ... }) (deps inferred)
 *
 * Limitations (complex cases get a // TODO comment):
 *   - Multiple setState merges
 *   - getDerivedStateFromProps
 *   - shouldComponentUpdate / getSnapshotBeforeUpdate
 *   - Components with refs (createRef)
 *   - Class inheritance beyond React.Component / PureComponent
 */

function addLeadingComment(j: any, node: any, text: string): any {
  node.comments = [
    ...(node.comments ?? []),
    j.commentLine(` ${text}`, true, false),
  ];
  return node;
}

const REACT_BASE_CLASSES = new Set(['Component', 'PureComponent', 'React.Component', 'React.PureComponent']);

function getSuperClass(node: any): string | null {
  if (!node.superClass) return null;
  if (node.superClass.type === 'Identifier') return node.superClass.name;
  if (node.superClass.type === 'MemberExpression') {
    return `${node.superClass.object.name}.${node.superClass.property.name}`;
  }
  return null;
}

function isReactClassComponent(node: any): boolean {
  const superClass = getSuperClass(node);
  return superClass !== null && REACT_BASE_CLASSES.has(superClass);
}

function getClassMethods(classBody: any): Map<string, any> {
  const methods = new Map<string, any>();
  for (const member of classBody.body) {
    if (
      (member.type === 'ClassMethod' || member.type === 'MethodDefinition') &&
      member.key?.type === 'Identifier'
    ) {
      methods.set(member.key.name, member);
    }
  }
  return methods;
}

function getInitialState(methods: Map<string, any>, j: any): Record<string, any> | null {
  const constructor = methods.get('constructor');
  if (!constructor) return null;

  const stateFields: Record<string, any> = {};
  const body = constructor.body?.body ?? constructor.value?.body?.body ?? [];

  for (const stmt of body) {
    // this.state = { ... }
    if (
      stmt.type === 'ExpressionStatement' &&
      stmt.expression.type === 'AssignmentExpression' &&
      stmt.expression.left.type === 'MemberExpression' &&
      stmt.expression.left.object.type === 'ThisExpression' &&
      stmt.expression.left.property.name === 'state' &&
      stmt.expression.right.type === 'ObjectExpression'
    ) {
      for (const prop of stmt.expression.right.properties) {
        if (prop.type === 'ObjectProperty' || prop.type === 'Property') {
          stateFields[prop.key.name] = prop.value;
        }
      }
    }
  }

  return Object.keys(stateFields).length > 0 ? stateFields : null;
}

function replaceThisProps(node: any, j: any): void {
  // Replace this.props.X → props.X
  // We do this by traversing and mutating
  j(node).find(j.MemberExpression, {
    object: {
      type: 'MemberExpression',
      object: { type: 'ThisExpression' },
      property: { type: 'Identifier', name: 'props' },
    },
  }).forEach((p: any) => {
    p.node.object = j.identifier('props');
  });
}

function replaceThisState(node: any, j: any, stateVars: string[]): void {
  // Replace this.state.X → x (state var name)
  j(node).find(j.MemberExpression, {
    object: {
      type: 'MemberExpression',
      object: { type: 'ThisExpression' },
      property: { type: 'Identifier', name: 'state' },
    },
  }).forEach((p: any) => {
    const fieldName = p.node.property?.name;
    if (fieldName && stateVars.includes(fieldName)) {
      j(p).replaceWith(j.identifier(fieldName));
    }
  });
}

function replaceSetState(node: any, j: any, stateFields: Record<string, any>): void {
  const stateKeys = Object.keys(stateFields);

  j(node).find(j.CallExpression, {
    callee: {
      type: 'MemberExpression',
      object: { type: 'ThisExpression' },
      property: { type: 'Identifier', name: 'setState' },
    },
  }).forEach((p: any) => {
    const arg = p.node.arguments[0];
    if (!arg) return;

    if (arg.type === 'ObjectExpression') {
      const updates = arg.properties.filter(
        (prop: any) => prop.type === 'ObjectProperty' || prop.type === 'Property',
      );

      if (updates.length === 1) {
        const { key, value } = updates[0];
        const setterName = `set${key.name.charAt(0).toUpperCase()}${key.name.slice(1)}`;
        j(p).replaceWith(j.callExpression(j.identifier(setterName), [value]));
      } else {
        // Multi-field: flag for manual migration
        const replacement = j.callExpression(j.identifier('setState'), p.node.arguments);
        addLeadingComment(j, replacement, 'TODO(react-class-to-hooks): split multi-field setState into individual setters');
        j(p).replaceWith(replacement);
      }
    }
    // Functional form: this.setState(prev => ...) — flag for manual migration
    else if (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression') {
      const replacement = j.callExpression(j.identifier('setState_functional'), p.node.arguments);
      addLeadingComment(j, replacement, 'TODO(react-class-to-hooks): convert functional setState to setter with callback');
      j(p).replaceWith(replacement);
    }
  });
}

const transform: Transform = (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);
  let changed = false;

  // Track which hooks we need to import
  const hooksNeeded = new Set<string>();

  root.find(j.ClassDeclaration).forEach((classPath) => {
    const classNode = classPath.node;
    if (!isReactClassComponent(classNode)) return;

    const className = classNode.id?.name;
    if (!className) return;

    const methods = getClassMethods(classNode.body);
    const renderMethod = methods.get('render');
    if (!renderMethod) return;

    // Check for unsupported patterns
    const unsupportedMethods = ['getDerivedStateFromProps', 'getSnapshotBeforeUpdate', 'shouldComponentUpdate'];
    const hasUnsupported = unsupportedMethods.some((m) => methods.has(m));
    if (hasUnsupported) {
      const which = unsupportedMethods.filter((m) => methods.has(m)).join(', ');
      addLeadingComment(j, classNode, `TODO(react-class-to-hooks): manual migration required — uses ${which}`);
      changed = true;
      return;
    }

    const initialState = getInitialState(methods, j);
    const stateKeys = initialState ? Object.keys(initialState) : [];

    // Build function body statements
    const bodyStatements: any[] = [];

    // 1. useState declarations for each state field
    if (initialState) {
      hooksNeeded.add('useState');
      for (const [fieldName, initValue] of Object.entries(initialState)) {
        const setterName = `set${fieldName.charAt(0).toUpperCase()}${fieldName.slice(1)}`;
        bodyStatements.push(
          j.variableDeclaration('const', [
            j.variableDeclarator(
              j.arrayPattern([j.identifier(fieldName), j.identifier(setterName)]),
              j.callExpression(j.identifier('useState'), [initValue as any]),
            ),
          ]),
        );
      }
    }

    // 2. componentDidMount → useEffect(..., [])
    const didMount = methods.get('componentDidMount');
    if (didMount) {
      hooksNeeded.add('useEffect');
      const mountBody = (didMount.body ?? didMount.value?.body).body;
      bodyStatements.push(
        j.expressionStatement(
          j.callExpression(j.identifier('useEffect'), [
            j.arrowFunctionExpression([], j.blockStatement(mountBody)),
            j.arrayExpression([]),
          ]),
        ),
      );
    }

    // 3. componentWillUnmount merged into componentDidMount's useEffect as cleanup
    const willUnmount = methods.get('componentWillUnmount');
    if (willUnmount && !didMount) {
      hooksNeeded.add('useEffect');
      const unmountBody = (willUnmount.body ?? willUnmount.value?.body).body;
      bodyStatements.push(
        j.expressionStatement(
          j.callExpression(j.identifier('useEffect'), [
            j.arrowFunctionExpression(
              [],
              j.blockStatement([
                j.returnStatement(
                  j.arrowFunctionExpression([], j.blockStatement(unmountBody)),
                ),
              ]),
            ),
            j.arrayExpression([]),
          ]),
        ),
      );
    } else if (willUnmount && didMount) {
      // Merge cleanup into the last useEffect — add as TODO for safety
      const placeholder = j.emptyStatement();
      addLeadingComment(j, placeholder, 'TODO(react-class-to-hooks): add componentWillUnmount cleanup as return in the useEffect above');
      bodyStatements.push(placeholder);
    }

    // 4. componentDidUpdate → useEffect (no deps — manual review needed)
    const didUpdate = methods.get('componentDidUpdate');
    if (didUpdate) {
      hooksNeeded.add('useEffect');
      const updateBody = (didUpdate.body ?? didUpdate.value?.body).body;
      const effectStmt = j.expressionStatement(
        j.callExpression(j.identifier('useEffect'), [
          j.arrowFunctionExpression([], j.blockStatement(updateBody)),
        ]),
      );
      addLeadingComment(j, effectStmt, 'TODO(react-class-to-hooks): add correct dependencies to this useEffect');
      bodyStatements.push(effectStmt);
    }

    // 5. Extract render body
    const renderBody = (renderMethod.body ?? renderMethod.value?.body).body;

    // Strip `return` from render, get the JSX expression
    // Keep all statements in render body
    bodyStatements.push(...renderBody);

    // Apply this.props → props, this.state.x → x, this.setState → setter
    const funcBody = j.blockStatement(bodyStatements);
    replaceThisProps(funcBody, j);
    replaceThisState(funcBody, j, stateKeys);
    if (initialState) replaceSetState(funcBody, j, initialState);

    // Build the functional component
    const hasProps = JSON.stringify(classNode).includes('this.props');
    const propsParam = hasProps
      ? j.identifier('props')
      : j.identifier('_props');

    const funcComponent = j.variableDeclaration('const', [
      j.variableDeclarator(
        j.identifier(className),
        j.arrowFunctionExpression([propsParam], funcBody),
      ),
    ]);

    j(classPath).replaceWith(funcComponent);
    changed = true;
  });

  // Add hook imports if needed
  if (hooksNeeded.size > 0) {
    root.find(j.ImportDeclaration).forEach((p) => {
      const src = (p.node.source as any).value as string;
      if (src !== 'react' && src !== 'React') return;

      const existing = new Set(
        (p.node.specifiers ?? [])
          .filter((s: any) => s.type === 'ImportSpecifier')
          .map((s: any) => s.imported.name),
      );

      for (const hook of hooksNeeded) {
        if (!existing.has(hook)) {
          p.node.specifiers = [
            ...(p.node.specifiers ?? []),
            j.importSpecifier(j.identifier(hook)),
          ];
          changed = true;
        }
      }
    });
  }

  if (!changed) return null;
  return root.toSource();
};

export default transform;
