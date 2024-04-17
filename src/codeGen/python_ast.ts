export type SyntaxNode =
    | Module
    | Import
    | From
    | Decorator
    | Decorate
    | Def
    | Parameter
    | Assignment
    | Assert
    | Pass
    | Return
    | Yield
    | Raise
    | Continue
    | Break
    | Global
    | Nonlocal
    | If
    | Else
    | While
    | For
    | Try
    | With
    | Call
    | Index
    | Slice
    | Dot
    | IfExpr
    | CompFor
    | CompIf
    | Lambda
    | UnaryOperator
    | BinaryOperator
    | Starred
    | Tuple
    | ListExpr
    | SetExpr
    | DictExpr
    | Name
    | Literal
    | Class;

export const MODULE = 'module';
export interface Module{
    type: typeof MODULE;
    code: SyntaxNode[];
}

export const IMPORT = 'import';
export interface Import {
  type: typeof IMPORT;
  names: { path: string; name?: string; location: string }[];
}

export const FROM = 'from';
export interface From{
  type: typeof FROM;
  base: string;
  imports: { path: string; name: string; location: string }[];
}

export const DECORATOR = 'decorator';
export interface Decorator{
  type: typeof DECORATOR;
  decorator: string;
  args: SyntaxNode[];
}

export const DECORATE = 'decorate';
export interface Decorate {
  type: typeof DECORATE;
  decorators: Decorator[];
  def: SyntaxNode;
}

export const DEF = 'def';
export interface Def {
  type: typeof DEF;
  name: string;
  params: Parameter[];
  code: SyntaxNode[];
}

export const PARAMETER = 'parameter';
export interface Parameter {
  type: typeof PARAMETER;
  name: string;
  anno?: SyntaxNode;
  default_value?: SyntaxNode;
  star: boolean;
  starstar: boolean;
}

export const ASSIGN = 'assign';
export interface Assignment {
  type: typeof ASSIGN;
  op: string | undefined; // defined for augment e.g. +=
  targets: SyntaxNode[];
  sources: SyntaxNode[];
}

export const ASSERT = 'assert';
export interface Assert{
  type: typeof ASSERT;
  cond: SyntaxNode;
  err: SyntaxNode;
}

export const PASS = 'pass';
export interface Pass{
  type: typeof PASS;
}

export const RETURN = 'return';
export interface Return{
  type: typeof RETURN;
  values: SyntaxNode[];
}

export const YIELD = 'yield';
export interface Yield{
  type: typeof YIELD;
  value: SyntaxNode[];
  from?: SyntaxNode;
}

export const RAISE = 'raise';
export interface Raise{
  type: typeof RAISE;
  err: SyntaxNode;
}

export const BREAK = 'break';
export interface Break{
  type: typeof BREAK;
}

export const CONTINUE = 'continue';
export interface Continue{
  type: typeof CONTINUE;
}

export const GLOBAL = 'global';

export interface Global  {
  type: typeof GLOBAL;
  names: string[];
}

export const NONLOCAL = 'nonlocal';

export interface Nonlocal  {
  type: typeof NONLOCAL;
  names: string[];
}

export const IF = 'if';

export interface If  {
  type: typeof IF;
  cond: SyntaxNode;
  code: SyntaxNode[];
  elif: { cond: SyntaxNode; code: SyntaxNode[] }[];
  else?: Else;
}

export const WHILE = 'while';

export interface While  {
  type: typeof WHILE;
  cond: SyntaxNode;
  code: SyntaxNode[];
  else: SyntaxNode[];
}

export const ELSE = 'else';

export interface Else  {
  type: typeof ELSE;
  code: SyntaxNode[];
}

export const FOR = 'for';

export interface For  {
  type: typeof FOR;
  target: SyntaxNode[];
  iter: SyntaxNode[];
  code: SyntaxNode[];
  else?: SyntaxNode[];
//   decl_location: Location;
}

export const COMPFOR = 'comp_for';

export interface CompFor  {
  type: typeof COMPFOR;
  for: SyntaxNode[];
  in: SyntaxNode;
}

export const COMPIF = 'comp_if';

export interface CompIf  {
  type: typeof COMPIF;
  test: SyntaxNode;
}

export const TRY = 'try';

export interface Try  {
  type: typeof TRY;
  code: SyntaxNode[];
  excepts: { cond: SyntaxNode; name: string; code: SyntaxNode[] }[];
  else: SyntaxNode[];
  finally: SyntaxNode[];
}

export const WITH = 'with';

export interface With  {
  type: typeof WITH;
  items: { with: SyntaxNode; as: SyntaxNode }[];
  code: SyntaxNode[];
}

export const CALL = 'call';

export interface Call  {
  type: typeof CALL;
  func: SyntaxNode;
  args: Argument[];
}

export const ARG = 'arg';

export interface Argument  {
  type: typeof ARG;
  actual: SyntaxNode;
  keyword?: SyntaxNode;
  loop?: CompFor;
  varargs?: boolean;
  kwargs?: boolean;
}

export const INDEX = 'index';

export interface Index  {
  type: typeof INDEX;
  value: SyntaxNode;
  args: SyntaxNode[];
}

export const SLICE = 'slice';

export interface Slice  {
  type: typeof SLICE;
  start?: SyntaxNode;
  stop?: SyntaxNode;
  step?: SyntaxNode;
}

export const DOT = 'dot';

export interface Dot  {
  type: typeof DOT;
  value: SyntaxNode;
  name: string;
}

export const IFEXPR = 'ifexpr';

export interface IfExpr  {
  type: typeof IFEXPR;
  test: SyntaxNode;
  then: SyntaxNode;
  else: SyntaxNode;
}

export const LAMBDA = 'lambda';

export interface Lambda  {
  type: typeof LAMBDA;
  args: Parameter[];
  code: SyntaxNode;
}

export const UNOP = 'unop';

export interface UnaryOperator  {
  type: typeof UNOP;
  op: string;
  operand: SyntaxNode;
}

export const BINOP = 'binop';

export interface BinaryOperator  {
  type: typeof BINOP;
  op: string;
  left: SyntaxNode;
  right: SyntaxNode;
}

export const STARRED = 'starred';

export interface Starred  {
  type: typeof STARRED;
  value: SyntaxNode;
}

export const TUPLE = 'tuple';

export interface Tuple  {
  type: typeof TUPLE;
  items: SyntaxNode[];
}

export const LIST = 'list';

export interface ListExpr  {
  type: typeof LIST;
  items: SyntaxNode[];
}

export const SET = 'set';

export interface SetExpr  {
  type: typeof SET;
  entries: SyntaxNode[];
  comp_for?: SyntaxNode[];
}

export const DICT = 'dict';

export interface DictExpr  {
  type: typeof DICT;
  entries: { k: SyntaxNode; v: SyntaxNode }[];
  comp_for?: SyntaxNode[];
}

export const NAME = 'name';

export interface Name  {
  type: typeof NAME;
  id: string;
}

export const LITERAL = 'literal';

export interface Literal  {
  type: typeof LITERAL;
  value: any;
}

export const CLASS = 'class';

export interface Class  {
  type: typeof CLASS;
  name: string;
  extends: SyntaxNode[];
  code: SyntaxNode[];
}

export function Module(code: SyntaxNode[]): Module {
  return {type: "module", code}
}


export function Import(names: { path: string; name?: string; location: string; }[]): Import {
  return {type: "import", names}
}


export function From(base: string, imports: { path: string; name: string; location: string; }[]): From {
  return {type: "from", base, imports}
}


export function Decorator(decorator: string, args: SyntaxNode[]): Decorator {
  return {type: "decorator", decorator, args}
}


export function Decorate(decorators: Decorator[], def: SyntaxNode): Decorate {
  return {type: "decorate", decorators, def}
}


export function Def(name: string, params: Parameter[], code: SyntaxNode[]): Def {
  return {type: "def", name, params, code}
}


export function Parameter(name: string, anno?: SyntaxNode, default_value?: SyntaxNode, star?: boolean, starstar?: boolean): Parameter {
  return {type: "parameter", name, anno, default_value, star: Boolean(star), starstar: Boolean(starstar)}
}


export function Assignment(op: string, targets: SyntaxNode[], sources: SyntaxNode[]): Assignment {
  return {type: "assign", op, targets, sources}
}


export function Assert(cond: SyntaxNode, err: SyntaxNode): Assert {
  return {type: "assert", cond, err}
}


export function Pass(): Pass {
  return {type: "pass"}
}


export function Return(values: SyntaxNode[]): Return {
  return {type: "return", values}
}


export function Yield(value: SyntaxNode[], from: SyntaxNode): Yield {
  return {type: "yield", value, from}
}


export function Raise(err: SyntaxNode): Raise {
  return {type: "raise", err}
}


export function Break(): Break {
  return {type: "break"}
}


export function Continue(): Continue {
  return {type: "continue"}
}


export function Global(names: string[]): Global {
  return {type: "global", names}
}


export function Nonlocal(names: string[]): Nonlocal {
  return {type: "nonlocal", names}
}


export function If(cond: SyntaxNode, code: SyntaxNode[], elif: { cond: SyntaxNode; code: SyntaxNode[]; }[], els?: Else): If {
  return {type: "if", cond, code, elif, else: els}
}


export function While(cond: SyntaxNode, code: SyntaxNode[], els: SyntaxNode[]): While {
  return {type: "while", cond, code, else: els}
}


export function Else(code: SyntaxNode[]): Else {
  return {type: "else", code}
}


export function For(target: SyntaxNode[], iter: SyntaxNode[], code: SyntaxNode[], els?: SyntaxNode[]): For {
  return {type: "for", target, iter, code, else: els}
}


export function CompFor(f: SyntaxNode[], i: SyntaxNode): CompFor {
  return {type: "comp_for", for: f, in: i}
}


export function CompIf(test: SyntaxNode): CompIf {
  return {type: "comp_if", test}
}


export function Try(code: SyntaxNode[], excepts: { cond: SyntaxNode; name: string; code: SyntaxNode[]; }[], els: SyntaxNode[], fin: SyntaxNode[]): Try {
  return {type: "try", code, excepts, else: els, finally: fin}
}


export function With(items: { with: SyntaxNode; as: SyntaxNode; }[], code: SyntaxNode[]): With {
  return {type: "with", items, code}
}


export function Call(func: SyntaxNode, args: Argument[]): Call {
  return {type: "call", func, args}
}


export function Argument(actual: SyntaxNode, keyword?: SyntaxNode, loop?: CompFor, varargs?: boolean, kwargs?: boolean): Argument {
  return {type: "arg", actual, keyword, loop, varargs, kwargs}
}


export function Index(value: SyntaxNode, args: SyntaxNode[]): Index {
  return {type: "index", value, args}
}


export function Slice(start: SyntaxNode, stop: SyntaxNode, step: SyntaxNode): Slice {
  return {type: "slice", start, stop, step}
}


export function Dot(value: SyntaxNode, name: string): Dot {
  return {type: "dot", value, name}
}


export function IfExpr(test: SyntaxNode, then: SyntaxNode, els: SyntaxNode): IfExpr {
  return {type: "ifexpr", test, then, else: els}
}


export function Lambda(args: Parameter[], code: SyntaxNode): Lambda {
  return {type: "lambda", args, code}
}


export function UnaryOperator(op: string, operand: SyntaxNode): UnaryOperator {
  return {type: "unop", op, operand}
}


export function BinaryOperator(op: string, left: SyntaxNode, right: SyntaxNode): BinaryOperator {
  return {type: "binop", op, left, right}
}


export function Starred(value: SyntaxNode): Starred {
  return {type: "starred", value}
}


export function Tuple(items: SyntaxNode[]): Tuple {
  return {type: "tuple", items}
}


export function ListExpr(items: SyntaxNode[]): ListExpr {
  return {type: "list", items}
}


export function SetExpr(entries: SyntaxNode[], comp_for: SyntaxNode[]): SetExpr {
  return {type: "set", entries, comp_for}
}


export function DictExpr(entries: { k: SyntaxNode; v: SyntaxNode; }[], comp_for: SyntaxNode[]): DictExpr {
  return {type: "dict", entries, comp_for}
}


export function Name(id: string): Name {
  return {type: "name", id}
}


export function Literal(value: any): Literal {
  return {type: "literal", value}
}


export function Class(name: string, ext: SyntaxNode[], code: SyntaxNode[]): Class {
  return {type: "class", name, extends: ext, code}
}