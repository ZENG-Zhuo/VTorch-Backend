import { SyntaxNode, Argument, Parameter } from './python_ast';

const comma = ', ';

// tslint:disable-next-line: max-func-body-length
export function printTabbed(node: SyntaxNode, tabLevel: number, showTabs: Boolean = false): string {
  const tabs = showTabs ? ' '.repeat(4 * tabLevel) : "";
  if(!node)
    return "##UNDEFINED##";
  switch (node.type) {
    case 'assert':
      return tabs + 'assert ' + printNode(node.cond);
    case 'assign':
      return (
        tabs +
        commaSep(node.targets) +
        ' ' +
        (node.op || '=') +
        ' ' +
        commaSep(node.sources)
      );
    case 'binop':
      return tabs + '(' + printNode(node.left) + node.op + printNode(node.right) + ')';
    case 'break':
      return tabs + 'break';
    case 'call':
      return tabs + printNode(node.func) + '(' + node.args.map(printArg) + ')';
    case 'class':
      return (
        tabs +
        'class ' +
        node.name +
        (node.extends ? '(' + commaSep(node.extends) + ')' : '') +
        ':' + lines(node.code, tabLevel + 1)
      );
    case 'comp_for':
    case 'comp_if':
      throw 'not implemented';
    case 'continue':
      return tabs + 'continue';
    case 'decorator':
      return (
        '@' +
        node.decorator +
        (node.args ? '(' + commaSep(node.args) + ')' : '')
      );
    case 'decorate':
      return (
        tabs +
        lines(node.decorators, tabLevel) +
        printTabbed(node.def, tabLevel)
      );
    case 'def':
      return (
        tabs +
        'def ' +
        node.name +
        '(' +
        node.params.map(printParam).join(comma) +
        '):' + lines(node.code, tabLevel + 1)
      );
    case 'dict':
      return tabs + '{' + node.entries.map(e => e.k + ':' + e.v) + '}';
    case 'dot':
      return tabs + printNode(node.value) + '.' + node.name;
    case 'else':
      return tabs + 'else:' + lines(node.code, tabLevel + 1);
    case 'for':
      return (
        tabs +
        'for ' +
        commaSep(node.target) +
        ' in ' +
        commaSep(node.iter) +
        ':' + lines(node.code, tabLevel + 1) +
        (node.else ? lines(node.else, tabLevel + 1) : '')
      );
    case 'from':
      return (
        tabs +
        'from ' +
        node.base +
        ' import ' +
        node.imports
          .map(im => im.path + (im.name ? ' as ' + im.name : ''))
          .join(comma)
      );
    case 'global':
      return tabs + 'global ' + node.names.join(comma);
    case 'if':
      return (
        tabs +
        'if ' +
        printNode(node.cond) +
        ':' + lines(node.code, tabLevel + 1) +
        (node.elif
          ? node.elif.map(
              elif =>
                tabs +
                'elif ' +
                elif.cond +
                ':' +
                lines(elif.code, tabLevel + 1)
            )
          : '') +
        (node.else ? "\n" + tabs + 'else:' + lines(node.else.code, tabLevel + 1) : '')
      );
    case 'ifexpr':
      return tabs + (
        printNode(node.then) +
        ' if ' +
        printNode(node.test) +
        ' else ' +
        printNode(node.else)
      );
    case 'import':
      return (
        tabs +
        'import ' +
        node.names
          .map(n => n.path + (n.name ? ' as ' + n.name : ''))
          .join(comma)
      );
    case 'index':
      return tabs + printNode(node.value) + '[' + commaSep(node.args) + ']';
    case 'lambda':
      return tabs + (
        'lambda ' +
        node.args.map(printParam).join(comma) +
        ': ' +
        printNode(node.code)
      );
    case 'list':
      return tabs + '[' + node.items.map(item => printNode(item)).join(comma) + ']';
    case 'literal':
      return tabs + typeof node.value === 'string' && node.value.indexOf('\n') >= 0
        ? '""' + node.value + '""'
        : node.value.toString();
    case 'module':
      return lines(node.code, tabLevel);
    case 'name':
      return tabs + node.id;
    case 'nonlocal':
      return tabs + 'nonlocal ' + node.names.join(comma);
    case 'raise':
      return tabs + 'raise ' + printNode(node.err);
    case 'return':
      return tabs + 'return ' + (node.values ? commaSep(node.values) : '');
    case 'set':
      return tabs + '{' + commaSep(node.entries) + '}';
    case 'slice':
      return tabs + (
        (node.start ? printNode(node.start) : '') +
        ':' +
        (node.stop ? printNode(node.stop) : '') +
        (node.step ? ':' + printNode(node.step) : '')
      );
    case 'starred':
      return tabs + '*' + printNode(node.value);
    case 'try':
      return (
        tabs +
        'try:' +
        lines(node.code, tabLevel + 1) +
        (node.excepts
          ? node.excepts.map(
              ex =>
                tabs +
                'except ' +
                (ex.cond
                  ? printNode(ex.cond) + (ex.name ? ' as ' + ex.name : '')
                  : '') +
                ':' +
                lines(ex.code, tabLevel + 1)
            )
          : '') +
        (node.else ? tabs + 'else:' + lines(node.else, tabLevel + 1) : '') +
        (node.finally
          ? tabs + 'finally:' + lines(node.finally, tabLevel + 1)
          : '')
      );
    case 'tuple':
      if(node.items.length == 1)
          return tabs + '(' + printNode(node.items[0]) + ",)";
      return tabs + '(' + commaSep(node.items) + ')';
    case 'unop':
      return tabs + node.op + '(' + printNode(node.operand) + ')';
    case 'while':
      return (
        tabs +
        'while ' +
        printNode(node.cond) +
        ':' +
        lines(node.code, tabLevel + 1)
      );
    case 'with':
      return (
        tabs +
        'with ' +
        node.items.map(w => w.with + (w.as ? ' as ' + w.as : '')).join(comma) +
        ':' +
        lines(node.code, tabLevel + 1)
      );
    case 'yield':
      return (
        tabs +
        'yield ' +
        (node.from ? printNode(node.from) : '') +
        (node.value ? commaSep(node.value) : '')
      );
    default:
      // throw 'unknown type ' + node.type;
      return `###UNKNOWN TYPE ${node.type}###`
  }
}

function printParam(param: Parameter): string {
  return (
    (param.star ? '*' : '') +
    (param.starstar ? '**' : '') +
    param.name +
    (param.default_value ? '=' + printNode(param.default_value) : '') +
    (param.anno ? printNode(param.anno) : '')
  );
}

function printArg(arg: Argument): string {
  return (
    (arg.kwargs ? '**' : '') +
    (arg.varargs ? '*' : '') +
    (arg.keyword ? printNode(arg.keyword) + '=' : '') +
    printNode(arg.actual) +
    (arg.loop ? ' for ' + arg.loop.for + ' in ' + arg.loop.in : '')
  );
}

function commaSep(items: SyntaxNode[]): string {
  return items.map(printNode).join(comma);
}

function lines(items: SyntaxNode[], tabLevel: number): string {
  if(items.length == 0)
    return "\n" + ' '.repeat(4 * tabLevel) + "pass";
  return "\n" + items
    .map(i => printTabbed(i, tabLevel, true))
    .join(tabLevel === 0 ? '\n\n' : '\n'); // seperate top-level definitons with an extra newline
}

export function printNode(node: SyntaxNode): string {
  return printTabbed(node, 0);
}
