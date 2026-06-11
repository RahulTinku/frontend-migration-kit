import type { Transform } from 'jscodeshift';

/**
 * deprecated-react-apis
 *
 * Renames deprecated React lifecycle methods to their UNSAFE_ equivalents,
 * as required by React 16.9+ and React 18 StrictMode.
 *
 * Handles:
 *   componentWillMount         → UNSAFE_componentWillMount
 *   componentWillReceiveProps  → UNSAFE_componentWillReceiveProps
 *   componentWillUpdate        → UNSAFE_componentWillUpdate
 */

const LIFECYCLE_RENAMES: Record<string, string> = {
  componentWillMount: 'UNSAFE_componentWillMount',
  componentWillReceiveProps: 'UNSAFE_componentWillReceiveProps',
  componentWillUpdate: 'UNSAFE_componentWillUpdate',
};

const transform: Transform = (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);
  let changed = false;

  function rename(keyNode: any): void {
    if (keyNode?.type !== 'Identifier') return;
    const next = LIFECYCLE_RENAMES[keyNode.name];
    if (next) {
      keyNode.name = next;
      changed = true;
    }
  }

  // Class method definitions: componentWillMount() { }
  root.find(j.MethodDefinition).forEach((path) => rename(path.node.key));

  // Class property / arrow-function syntax: componentWillMount = () => { }
  root.find(j.ClassProperty).forEach((path) => rename((path.node as any).key));

  // Object method shorthand (rare but valid): { componentWillMount() {} }
  root.find(j.ObjectMethod).forEach((path) => rename((path.node as any).key));

  if (!changed) return null;
  return root.toSource();
};

export default transform;
