import { parse, createVisitor } from "python-ast";
import { TestContext } from "python-ast/dist/parser/Python3Parser";
import {
  FuncdefContext,
  ClassdefContext,
  TfpdefContext,
  ParametersContext,
} from "python-ast/dist/parser/Python3Parser";
import {
  TypeInfo,
  ClassInfo,
  ParameterInfo,
  FuncInfo,
} from "../common/pythonObjectTypes";

function parseTypeHint(typeContext?: TestContext): TypeInfo | undefined {
  if (typeContext == undefined) return undefined;
  return parseTypeString(typeContext.text);
}

function parseTypeString(typeString: string): TypeInfo {
  const trimmedTypeString = typeString.trim();
  if (trimmedTypeString === "...") return new TypeInfo("Variadic");
  // const typeInfoRegex = /^(\w+)(\[(.+)\])?(\.{3})?$/;
  const typeInfoRegex = /^([a-zA-Z.]+)(\[(.+)\])?(\.{3})?$/;
  const match = trimmedTypeString.match(typeInfoRegex);

  if (match) {
    const type = match[1];
    const subtypeString = match[3];
    const isVariadic = !!match[4];

    if (subtypeString) {
      const subtypes = parseSubtypes(subtypeString);
      const typeInfo = new TypeInfo(type, subtypes);

      if (isVariadic) {
        return new TypeInfo("Variadic", [typeInfo]);
      }

      return typeInfo;
    } else {
      if (type === "...") {
        return new TypeInfo("Variadic");
      }

      if (isVariadic) {
        return new TypeInfo("Variadic", [new TypeInfo(type)]);
      }

      return new TypeInfo(type);
    }
  } else {
    return new TypeInfo(trimmedTypeString);
    // throw new Error(`Invalid type string: ${typeString}`);
  }
}

function parseSubtypes(subtypeString: string): TypeInfo[] {
  let subtypes: TypeInfo[] = [];
  let currentLevel = 0;
  let startIndex = 0;

  for (let i = 0; i < subtypeString.length; i++) {
    if (subtypeString[i] === "," && currentLevel === 0) {
      const subtype = subtypeString.substring(startIndex, i).trim();
      subtypes.push(parseTypeString(subtype));
      startIndex = i + 1;
    } else if (subtypeString[i] === "[") {
      currentLevel++;
    } else if (subtypeString[i] === "]") {
      currentLevel--;
    }
  }

  const lastType = subtypeString.substring(startIndex).trim();
  subtypes.push(parseTypeString(lastType));

  return subtypes;
}

function parseParamerterDef(parameterContext: TfpdefContext): ParameterInfo {
  return new ParameterInfo(
    parameterContext.NAME().text,
    parseTypeHint(parameterContext.test())
  );
}

function parseParamerters(
  parametersContext: ParametersContext
): ParameterInfo[] {
  const argslist = parametersContext.typedargslist();
  if (argslist == undefined) return [];
  let result = argslist.tfpdef().map(parseParamerterDef) || [];
  if (argslist.COMMA().length < argslist.tfpdef.length) {
    let pointer = result.length - 1;
    if (argslist.POWER()) {
      result[pointer].power = true;
      pointer -= 1;
    }
    if (argslist.STAR()) {
      result[pointer].star = true;
      pointer -= 1;
    }
  }

  let resultLen = result.length;
  const initialValues = argslist.test();
  let initialValueLen = initialValues.length;
  for (let i = 0; i < initialValueLen; i++) {
    result[resultLen - initialValueLen + i].initial_value =
      initialValues[i].text;
  }

  return result;
}

function parseFuncDef(funcContext: FuncdefContext): FuncInfo {
  return new FuncInfo(
    funcContext.NAME().text,
    parseParamerters(funcContext.parameters())
  );
}

function parseClassDef(classContext: ClassdefContext): ClassInfo {
  var resultClass = new ClassInfo(
    classContext.NAME().text,
    classContext
      .arglist()
      ?.argument()
      .map((argumentContext) => {
        return argumentContext.text;
      })
  );
  createVisitor({
    visitFuncdef: (funcDef) => {
      resultClass.addFunction(parseFuncDef(funcDef));
    },
  }).visit(classContext.suite());
  return resultClass;
}

export function extractAllObjects(code: string) {
  const allVariablePattern = /__all__\s*=\s*\[([\s\S]*?)\]/;
  const allVariableMatch = code.match(allVariablePattern);

  if (allVariableMatch) {
    const allVariableContent = allVariableMatch[1];

    // Parse the content into a TypeScript list
    const tsList = allVariableContent
      .trim()
      .split(",")
      .map((item) => item.trim().slice(1, -1)); // Remove quotes around the items

    return tsList;
  }
}

export function extractClassesAndFunctions(
  code: string
): [ClassInfo[], FuncInfo[]] {
  const tree = parse(code);
  const classes: ClassInfo[] = [];
  const functions: FuncInfo[] = [];

  createVisitor({
    visitClassdef: (classDef) => {
      classes.push(parseClassDef(classDef));
    },
    visitFuncdef: (funcDef) => {
      functions.push(parseFuncDef(funcDef));
    },
  }).visit(tree);

  return [classes, functions];
}
