import { parse, createVisitor } from "python-ast";
import {
    Dotted_nameContext,
    Import_stmtContext,
    TestContext,
} from "python-ast/dist/parser/Python3Parser";
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
    ImportInfo,
    RelativePathInfo,
} from "../common/pythonObjectTypes";
import { TerminalNode } from "antlr4ts/tree/TerminalNode";
import { NodeId } from "../common/pythonFileTypes";

function parseTypeHint(typeContext?: TestContext): TypeInfo | undefined {
    if (typeContext == undefined) return undefined;
    return parseTypeString(typeContext.text);
}

//export for testing only
export function parseTypeString(typeString: string): TypeInfo {
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
    if (argslist.COMMA().length < argslist.tfpdef().length) {
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
    if (argslist.POWER()) {
        resultLen -= 1;
    }
    if (argslist.STAR()) {
        resultLen -= 1;
    }
    const initialValues = argslist.test();
    let initialValueLen = initialValues.length;
    for (let i = 0; i < initialValueLen; i++) {
        result[resultLen - initialValueLen + i].initial_value =
            initialValues[i].text;
    }
    return result;
}

function parseFuncDef(funcContext: FuncdefContext): FuncInfo {
    const returnType = funcContext.test();
    return new FuncInfo(
        funcContext.NAME().text,
        parseParamerters(funcContext.parameters()),
        parseTypeHint(returnType)
    );
}

function parseClassDef(
    classContext: ClassdefContext,
    moduleID: NodeId
): ClassInfo {
    var resultClass = new ClassInfo(
        classContext.NAME().text,
        moduleID,
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

export function extractAllObjects(code: string): string[] | undefined {
    const allVariablePattern = /__all__\s*=\s*\[([\s\S]*?)\]/;
    const allVariableMatch = code.match(allVariablePattern);

    if (allVariableMatch) {
        const allVariableContent = allVariableMatch[1];

        // Parse the content into a TypeScript list
        const tsList = allVariableContent
            .trim()
            .split(",")
            .map((item) => item.trim().slice(1, -1))
            .filter((str: string) => str.trim() !== ""); // Remove quotes around the items

        return tsList;
    }
}

function parseDottedName(dottedName?: Dotted_nameContext): string[] {
    return dottedName ? dottedName.NAME().map((n) => n.text) : [];
}

function parseName(name: TerminalNode[]): string | [string, string] {
    if (name.length == 1) {
        return name[0].text;
    } else if (name.length == 2) {
        return [name[0].text, name[1].text];
    }

    throw "Invalid Name: " + name.map((n) => n.text);
}

function parseImportStmt(
    importStmt: Import_stmtContext
): ImportInfo[] | undefined {
    if (importStmt.import_name()) {
        return importStmt
            .import_name()
            ?.dotted_as_names()
            .dotted_as_name()
            .map(
                (dottedAsNameContext) =>
                    new ImportInfo(
                        new RelativePathInfo(
                            0,
                            parseDottedName(dottedAsNameContext.dotted_name()),
                            false
                        ),
                        undefined,
                        dottedAsNameContext.NAME()?.text
                    )
            );
    } else if (importStmt.import_from()) {
        const star = importStmt.import_from()?.STAR()?.text !== undefined;
        const dottedName = importStmt.import_from()?.dotted_name();
        const DOTS = importStmt.import_from()?.DOT();
        const ELLIPSISES = importStmt.import_from()?.ELLIPSIS();
        let dotCount = 0;
        if (DOTS) {
            dotCount = ELLIPSISES
                ? DOTS.length + ELLIPSISES.length * 3
                : DOTS.length;
        }
        return [
            new ImportInfo(
                new RelativePathInfo(
                    dotCount > 0 ? dotCount - 1 : 0,
                    parseDottedName(dottedName),
                    dotCount > 0
                ),
                star
                    ? "*"
                    : importStmt
                          .import_from()
                          ?.import_as_names()
                          ?.import_as_name()
                          .map((i) => parseName(i.NAME()))
            ),
        ];
    }
    throw "Unsupported import type";
}

export function extractClassesAndFunctions(
    code: string,
    moduleID: NodeId
): [ClassInfo[], FuncInfo[], ImportInfo[]] {
    const tree = parse(code.replace(/(\s?([\/\*])\s?,)+/g, ""));
    const classes: ClassInfo[] = [];
    const functions: FuncInfo[] = [];
    let imports: ImportInfo[] = [];

    createVisitor({
        visitImport_stmt: (importStmt) => {
            const parsedImports = parseImportStmt(importStmt);
            if (parsedImports) imports = imports.concat(parsedImports);
        },
        visitClassdef: (classDef) => {
            classes.push(parseClassDef(classDef, moduleID));
        },
        visitFuncdef: (funcDef) => {
            const parsedFunction = parseFuncDef(funcDef);
            let i: number = 1;
            while (true) {
                if (
                    !functions.find(
                        (f) => f.name === parsedFunction.name + "$" + String(i)
                    )
                )
                    break;
                i++;
            }
            parsedFunction.name = parsedFunction.name + "$" + String(i);
            functions.push(parsedFunction);
        },
    }).visit(tree);

    return [classes, functions, imports];
}
