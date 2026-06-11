import type { Transform } from 'jscodeshift';

/**
 * prop-types-to-ts
 *
 * Replaces PropTypes declarations with TypeScript interfaces.
 *
 * Handles:
 *   - Component.propTypes = { ... } static assignment
 *   - static propTypes = { ... } class property
 *   - Removes `import PropTypes from 'prop-types'`
 *   - Generates Props interface above the component
 *
 * Supported PropTypes:
 *   PropTypes.string / .number / .bool / .func / .any
 *   PropTypes.array / .object / .node / .element
 *   PropTypes.arrayOf(X) → X[]
 *   PropTypes.oneOf(['a', 'b']) → 'a' | 'b'
 *   PropTypes.shape({ ... }) → inline object type
 *   .isRequired strips optionality
 */

function propTypeToTSAnnotation(node: any, j: any): { type: any; required: boolean } {
  if (!node) return { type: j.tsUnknownKeyword(), required: false };

  // .isRequired suffix
  if (
    node.type === 'MemberExpression' &&
    node.property?.name === 'isRequired'
  ) {
    const inner = propTypeToTSAnnotation(node.object, j);
    return { type: inner.type, required: true };
  }

  // PropTypes.X (simple types)
  if (
    node.type === 'MemberExpression' &&
    node.object?.name === 'PropTypes' &&
    node.property?.type === 'Identifier'
  ) {
    return { type: simplePropType(node.property.name, j), required: false };
  }

  // PropTypes.arrayOf(X)
  if (
    node.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    node.callee.property?.name === 'arrayOf'
  ) {
    const inner = propTypeToTSAnnotation(node.arguments[0], j);
    return { type: j.tsArrayType(inner.type), required: false };
  }

  // PropTypes.oneOf(['a', 'b'])
  if (
    node.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    node.callee.property?.name === 'oneOf'
  ) {
    const elements: any[] = node.arguments[0]?.elements ?? [];
    const types = elements.map((el: any) => {
      if (el.type === 'StringLiteral' || (el.type === 'Literal' && typeof el.value === 'string')) {
        return j.tsLiteralType(j.stringLiteral(el.value));
      }
      if (el.type === 'NumericLiteral' || (el.type === 'Literal' && typeof el.value === 'number')) {
        return j.tsLiteralType(j.numericLiteral(el.value));
      }
      return j.tsStringKeyword();
    });
    return {
      type: types.length > 1 ? j.tsUnionType(types) : types[0] ?? j.tsUnknownKeyword(),
      required: false,
    };
  }

  // PropTypes.shape({ ... })
  if (
    node.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    node.callee.property?.name === 'shape'
  ) {
    const arg = node.arguments[0];
    if (arg?.type === 'ObjectExpression') {
      const members = arg.properties.map((prop: any) => {
        const { type: tsType, required } = propTypeToTSAnnotation(prop.value, j);
        const sig = j.tsPropertySignature.from({
          key: j.identifier(prop.key.name ?? prop.key.value),
          typeAnnotation: j.tsTypeAnnotation(tsType),
          optional: !required,
        });
        return sig;
      });
      return { type: j.tsTypeLiteral(members), required: false };
    }
  }

  return { type: j.tsUnknownKeyword(), required: false };
}

function simplePropType(name: string, j: any): any {
  switch (name) {
    case 'string': return j.tsStringKeyword();
    case 'number': return j.tsNumberKeyword();
    case 'bool': return j.tsBooleanKeyword();
    case 'any': return j.tsAnyKeyword();
    case 'func':
      return j.tsFunctionType.from({
        params: [],
        typeParameters: null,
        returnType: j.tsTypeAnnotation(j.tsVoidKeyword()),
      });
    case 'array': return j.tsArrayType(j.tsUnknownKeyword());
    case 'object': return j.tsObjectKeyword();
    case 'node':
    case 'element':
      return j.tsTypeReference(j.identifier('React.ReactNode'));
    default: return j.tsUnknownKeyword();
  }
}

const transform: Transform = (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);
  let changed = false;

  // Find static propTypes = { ... } or ComponentName.propTypes = { ... }
  const propTypesAssignments: Array<{ path: any; componentName: string; properties: any[] }> = [];

  // External assignment: MyComponent.propTypes = { ... }
  root.find(j.AssignmentExpression, {
    left: { type: 'MemberExpression', property: { type: 'Identifier', name: 'propTypes' } },
  })
    .filter((p) => p.parent.node.type === 'ExpressionStatement')
    .forEach((p) => {
      const componentName = (p.node.left as any).object?.name;
      const rhs = p.node.right;
      if (componentName && rhs.type === 'ObjectExpression') {
        propTypesAssignments.push({
          path: p.parent,
          componentName,
          properties: rhs.properties,
        });
      }
    });

  for (const { path, componentName, properties } of propTypesAssignments) {
    // Build interface members
    const members = properties
      .filter((p: any) => p.type === 'ObjectProperty' || p.type === 'Property')
      .map((prop: any) => {
        const propName: string = prop.key.name ?? prop.key.value;
        const { type: tsType, required } = propTypeToTSAnnotation(prop.value, j);
        return j.tsPropertySignature.from({
          key: j.identifier(propName),
          typeAnnotation: j.tsTypeAnnotation(tsType),
          optional: !required,
        });
      });

    const interfaceDecl = j.tsInterfaceDeclaration.from({
      id: j.identifier(`${componentName}Props`),
      typeParameters: null,
      extends: [],
      body: j.tsInterfaceBody(members),
    });

    // Insert interface before the component definition (class, function, or variable)
    const componentDef =
      root.find(j.ClassDeclaration, { id: { name: componentName } }).paths()[0] ??
      root.find(j.FunctionDeclaration, { id: { name: componentName } }).paths()[0] ??
      root
        .find(j.VariableDeclaration)
        .filter((vp) => (vp.node.declarations[0] as any)?.id?.name === componentName)
        .paths()[0];

    if (componentDef) {
      j(componentDef).insertBefore(interfaceDecl);
    }

    // Remove propTypes assignment
    j(path).remove();
    changed = true;
  }

  // Remove 'import PropTypes from "prop-types"'
  root.find(j.ImportDeclaration, { source: { value: 'prop-types' } }).forEach((p) => {
    j(p).remove();
    changed = true;
  });

  if (!changed) return null;
  return root.toSource();
};

export default transform;
