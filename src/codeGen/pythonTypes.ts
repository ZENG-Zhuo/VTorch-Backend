import { TypeInfo } from "../common/pythonObjectTypes"

export interface PythonType {
    readonly typename: string;
}

export const INTTYPE = "int";
export class Integer implements PythonType {
    readonly typename: string;
    readonly bitlenth: Number;
    constructor(bitlenth?: Number) {
        this.typename = INTTYPE;
        this.bitlenth = bitlenth ? bitlenth : 32;
    }
}

export const STRINGTYPE = "string";
export class String implements PythonType {
    readonly typename: string;
    constructor() {
        this.typename = STRINGTYPE;
    }
}

export const BOOLTYPE = "bool";
export class Boolean implements PythonType {
    readonly typename: string;
    constructor() {
        this.typename = BOOLTYPE;
    }
}

export const FLOATTYPE = "float";
export class Float implements PythonType {
    readonly typename: string;
    readonly bitlenth: Number;
    constructor(bitlenth?: Number) {
        this.typename = FLOATTYPE;
        this.bitlenth = bitlenth ? bitlenth : 32;
    }
}

export const LISTTYPE = "List";
export class List implements PythonType {
    readonly typename: string;
    readonly inner: PythonType;
    constructor(inner: PythonType) {
        this.typename = LISTTYPE;
        this.inner = inner;
    }
}

export const TUPLETYPE = "Tuple";
export class Tuple implements PythonType {
    readonly typename: string;
    readonly inners: PythonType[];
    constructor(readonly _inners: PythonType[]) {
        this.typename = TUPLETYPE;
        this.inners = _inners;
    }
}

export const OPTIONAL = "Optional";
export class Optional implements PythonType {
    readonly typename: string;
    readonly inner: PythonType;
    constructor(readonly _inner: PythonType) {
        this.typename = OPTIONAL;
        this.inner = _inner;
    }
}

export const UNIONTYPE = "Union";
export class Union implements PythonType {
    readonly typename: string;
    readonly alters: PythonType[];
    constructor(readonly _alters: PythonType[]) {
        this.typename = UNIONTYPE;
        this.alters = _alters;
    }
}

export const VARIADIC = "Variadic";
export class Variadic implements PythonType {
    readonly typename: string;
    constructor() {
        this.typename = VARIADIC;
    }
}

export const TENSOR = "Tensor";
export class Tensor implements PythonType{
    readonly typename: string;
    readonly typeArg: PythonType;
    constructor(typearg: PythonType = new Any()){
        this.typename = TENSOR;
        this.typeArg = typearg;
    }
}

export const ADT = "ADT";
export class Arbitrary implements PythonType {
    readonly typename: string;
    readonly adtName: string;
    readonly adtArgs: PythonType[];
    constructor(readonly name: string, readonly args: PythonType[]) {
        this.typename = ADT;
        this.adtName = name;
        this.adtArgs = args;
    }
}

export const ENUM = "Enum";
export class Enum implements PythonType {
    readonly typename: string;
    readonly enumname: string;
    static readonly mapping: Map<string, string[]> = new Map([
        ["dtype", ["float32",
            "float",
            "float64",
            "double",
            "float16",
            "bfloat16",
            "float8_e4m3fn",
            "float8_e4m3fnuz",
            "float8_e5m2",
            "float8_e5m2fnuz",
            "half",
            "uint8",
            "int8",
            "int16",
            "short",
            "int32",
            "int",
            "int64",
            "long",
            "complex32",
            "complex64",
            "chalf",
            "cfloat",
            "complex128",
            "cdouble",
            "quint8",
            "qint8",
            "qint32",
            "bool",
            "quint4x2",
            "quint2x4",
            "bits1x8",
            "bits2x4",
            "bits4x2",
            "bits8",
            "bits16"]],
        ["layout", ["strided",
            "sparse_coo",
            "sparse_csr",
            "sparse_csc",
            "sparse_bsr",
            "sparse_bsc",
            "_mkldnn",
            "jagged"]],
        ["memory_format", [
            "contiguous_format", "channels_last", "channels_last_3d", "preserve_format",
        ]],
        ["qscheme", [
            "per_tensor_affine",
            "per_channel_affine",
            "per_tensor_symmetric",
            "per_channel_symmetric",
            "per_channel_affine_float_qparams"
        ]]
    ]);
    constructor(enumName: string){
        this.typename = ENUM;
        this.enumname = enumName;
    }
}

export const ANYTYPE = "any";
export class Any implements PythonType {
    readonly typename: string;
    constructor() {
        this.typename = ANYTYPE;
    }
}

function checkPredefinedADT(typeinfo: TypeInfo): PythonType {
    function createFixLenTuple(len: number, cons: () => PythonType): PythonType {
        return new Tuple(Array(len).fill(cons()));
    }
    const typeName = typeinfo.getType();
    let matchresult = /_size_(\d)+_t/g.exec(typeName);
    if (matchresult) {
        return new Union([new Integer(), createFixLenTuple(parseInt(matchresult[1]), () => new Integer())]);
    }
    if (typeName == "_size_any_t") {
        return new Union([new Integer(), new Tuple([new Integer(), new Variadic()])]);
    }
    matchresult = /_size_(\d)+_opt_t/g.exec(typeName);
    if (matchresult) {
        return new Union([new Optional(new Integer()), createFixLenTuple(parseInt(matchresult[1]), () => new Optional(new Integer()))]);
    }
    if (typeName == "_size_any_opt_t") {
        return new Union([new Optional(new Integer()), new Tuple([new Optional(new Integer()), new Variadic()])]);
    }
    matchresult = /_ratio_(\d)+_t/g.exec(typeName);
    if (matchresult) {
        return new Union([new Float(), createFixLenTuple(parseInt(matchresult[1]), () => new Float())]);
    }
    if (typeName == "_ratio_any_t") {
        return new Union([new Float(), new Tuple([new Optional(new Integer()), new Variadic()])]);
    }
    if (typeName == "_tensor_list_t") {
        return new Union([new Tensor(), new Tuple([new Tensor(), new Variadic()])]);
    }
    if (typeName == "_maybe_indices_t") {
        return new Union([new Tensor(), new Tuple([new Tensor(), new Tensor()])]);
    }
    if (Enum.mapping.has(typeName)){
        return new Enum(typeName);
    }
    if (typeName[0] == "_"){
        let tempTypeInfo = new TypeInfo(typeName.substring(1), typeinfo.getSubtypes());
        let ret = toPythonType(tempTypeInfo);
        if(ret.typename != ADT)
            return ret;
    }
    return new Arbitrary(typeinfo.getType(), typeinfo.getSubtypes().map(toPythonType));
}

export function toPythonType(typeinfo?: TypeInfo): PythonType {
    if(!typeinfo)
        return new Any();
    switch (typeinfo.getType()) {
        case INTTYPE:
            return new Integer();
        case STRINGTYPE:
        case "str":
            return new String();
        case BOOLTYPE:
            return new Boolean();
        case FLOATTYPE:
            return new Float();
        case LISTTYPE:
        case "Sequence":
            if (typeinfo.getSubtypes().length == 1)
                return new List(toPythonType(typeinfo.getSubtypes()[0]));
            else
                throw "toPythonType error: list type " + typeinfo.toString() + " has more than 1 arguments";
        case TUPLETYPE:
            return new Tuple(typeinfo.getSubtypes().map(toPythonType));
        case OPTIONAL:
            if (typeinfo.getSubtypes().length == 1)
                return new Optional(toPythonType(typeinfo.getSubtypes()[0]));
            else
                throw "toPythonType error: optional type " + typeinfo.toString() + " has more than 1 arguments";
        case UNIONTYPE:{
            let subtypes = typeinfo.getSubtypes();
            if(subtypes.find(x => x.getType() == "None")){
                return new Optional(new Union(subtypes.filter(x => x.getType() != "None").map(toPythonType)))
            }
            else return new Union(subtypes.map(toPythonType));
        }            
        case VARIADIC:
            return new Variadic();
        case TENSOR:
            return new Tensor(typeinfo.getSubtypes().length == 1 ? toPythonType(typeinfo.getSubtypes()[0]) : new Any());
        default:
            return checkPredefinedADT(typeinfo);
    }
}

// split "a, (b,c)" into ["a", "(b,c)"]
function splitVal(expression: string): string[] | undefined {
    let exp = expression.trim();
    const curs = [["(", ")"], ["{", "}"], ["[", "]"]];
    let curCount: number[] = new Array(curs.length).fill(0);
    let lastPos = 0;
    let parsedVal: string[] = [];
    let quoteMark: string = "";
    for(let i = 0;i < exp.length;i ++){
        if(exp[i] == "\\")
            i++;
        else if(quoteMark){
            if(exp[i] != quoteMark)
                continue;
            else 
                quoteMark = "";
        }
        else if(exp[i] == "'" || exp[i] == "\"")
            quoteMark = exp[i];
        else if(exp[i] == ',' && curCount.reduce((x, y) => x+y) == 0){
            parsedVal.push(exp.substring(lastPos, i));
            lastPos = i+1;
        }
        else{
            curs.forEach(([st, ed], x) => 
                st == exp[i] ? curCount[x] ++ :
                ed == exp[i] ? curCount[x] -- : 
                null
            );
        }
    }
    if(curCount.reduce((x, y) => x+y) != 0)
        return undefined;
    parsedVal.push(exp.substring(lastPos, exp.length));
    return parsedVal;
}

export function convertTo(textString: string, targetType: PythonType): {succ: boolean, converted: any}{
    let tmp;
    const failed = {succ: false, converted: null};
    const str = textString.trim();
    // console.log("checking", textString, targetType);
    switch (targetType.typename) {
        case STRINGTYPE:
            if((str[0] == '"' && str[str.length - 1] == '"') || (str[0] == '\'' && str[str.length - 1] == '\'')){
                let splitted = splitVal(str);
                if(splitted && splitted.length == 1)    //reject "x", "y"
                    return {succ: true, converted: str};
            }
            return failed;
        case INTTYPE:{
            const num = Number(str);
            if(Number.isNaN(num) || !Number.isInteger(num)){
                return failed;
            }
            else return {succ: true, converted: tmp};
        }
        case FLOATTYPE:{
            const num = Number(str);
            if(Number.isNaN(tmp)){
                return failed;
            }
            else return {succ: true, converted: tmp};
        }
        case BOOLTYPE:
            if(str == "True")
                return {succ: true, converted: true};
            else if(str == "False")
                return {succ: true, converted: false};
            else return failed;
        case LISTTYPE:
            if(str[0] == "[" && str[str.length - 1] == "]"){
                let splitted = splitVal(str.substring(1, str.length-1));
                if(splitted instanceof Array){
                    let innertype = (targetType as List).inner;
                    let transResult = splitted.map(x => convertTo(x, innertype)).reduce((x, y) => x && y.succ, true);
                    return transResult ? {succ: transResult, converted: str} : failed;
                }
            }
            return failed;
        case TUPLETYPE:
            if(str[0] == "(" && str[str.length - 1] == ")"){
                let splitted = splitVal(str.substring(1, str.length-1));
                if(splitted instanceof Array){
                    let innertypes = (targetType as Tuple).inners;
                    if(innertypes[innertypes.length-1].typename != VARIADIC){   //not Tuple[T, ...]
                        if(splitted.length != innertypes.length)
                            return failed;
                        else {
                            let transResult = splitted.map((x, i) =>
                                convertTo(x, innertypes[i])
                            ).reduce((x, y) => x && y.succ, true);
                            return transResult ? {succ: transResult, converted: str} : failed;
                        }
                    }
                    else {                                                      //Tuple[T, ...]
                        if(splitted.length < innertypes.length - 1)
                            return failed;
                        else {
                            let transResult = splitted.map((x, i) => 
                                i < innertypes.length - 1 ? convertTo(x, innertypes[i]) : convertTo(x, innertypes[innertypes.length - 2])
                            ).reduce((x, y) => x && y.succ, true);
                            return transResult ? {succ: transResult, converted: str} : failed;
                        }
                    }
                }
            }
            return failed;
        case OPTIONAL:
            if(str == "None")
                return {succ: true, converted: str};
            else return convertTo(str, (targetType as Optional).inner);
        case UNIONTYPE: {
            let ret = (targetType as Union).alters.map(x => convertTo(str, x)).reduce((x, y) => x || y.succ, false);
            return ret ? {succ: ret, converted: str} : failed;
        }
        case TENSOR: {
            const tensorConsRegex = /^\s*(torch\.)?[tT]ensor\((.*)\)\s*$/g;
            let matchRet = tensorConsRegex.exec(str);
            if(matchRet){
                let args = splitVal(matchRet[2]);
                if(args instanceof Array){
                    let arg1ListCheck = convertTo(args[0], new List((targetType as Tensor).typeArg));
                    if(arg1ListCheck.succ)
                        return {succ: true, converted: matchRet[1] ? str : "torch." + str};
                }
            }
            return failed;
        }
        case ENUM: {
            const enumRegex = /^\s*(torch\.)?(\w+)\s*$/g;
            let matchRet = enumRegex.exec(str);
            if(!matchRet)
                return failed;
            else {
                if(Enum.mapping.get((targetType as Enum).enumname)?.find(x => x == matchRet[2])){
                    return {succ: true, converted: matchRet[1] ? str : "torch." + str};
                }
                else return failed;
            }
        }
        case ANYTYPE: 
            return {succ: true, converted: str};
        default:
            return failed;
    }
}

export function isSubType(srcType: PythonType, tarType: PythonType): boolean{
    switch (tarType.typename){
        case INTTYPE:
        case BOOLTYPE:
        case FLOATTYPE:
            return srcType.typename == INTTYPE || srcType.typename == BOOLTYPE || srcType.typename == FLOATTYPE;
        case STRINGTYPE:
            return srcType.typename == STRINGTYPE;
        case LISTTYPE:
            return srcType.typename == LISTTYPE && isSubType((srcType as List).inner, (tarType as List).inner);
        case TUPLETYPE:{
            if(srcType.typename != TUPLETYPE)   return false;
            function grepInneri(inners: PythonType[], idx: number): PythonType | undefined{
                if(idx >= inners.length - 1 && inners[inners.length-1].typename == VARIADIC)
                    return inners[inners.length-2];
                if(idx < inners.length)
                    return inners[idx];
                return undefined;
            }
            let srcInners = (srcType as Tuple).inners;
            let tarInners = (tarType as Tuple).inners;
            let maxLenth = srcInners.length > tarInners.length ? srcInners.length : tarInners.length;
            for(let i = 0;i < maxLenth;i ++){
                let srci = grepInneri(srcInners, i);
                let tari = grepInneri(tarInners, i);
                if(srci && tari){
                    if(!isSubType(srci, tari))
                        return false;
                }
                else return false;
            }
            if(srcInners[srcInners.length-1].typename == VARIADIC && tarInners[tarInners.length-1].typename != VARIADIC){
                return false;
            }
            return true;
        }
        case OPTIONAL:
            return isSubType(srcType, (tarType as Optional).inner) || 
                (srcType.typename == OPTIONAL && isSubType((srcType as Optional).inner, (tarType as Optional).inner));
        case UNIONTYPE: {
            if(srcType.typename != UNIONTYPE){
                return (tarType as Union).alters.map(x => isSubType(srcType, x)).reduce((x, y) => x || y, false);
            }
            else {
                return (srcType as Union).alters.map(src => 
                    (tarType as Union).alters.map(x => isSubType(src, x)).reduce((x, y) => x || y, false)
                ).reduce((x, y) => x && y, true);
            }
        }
        case ENUM:
            return srcType.typename == ENUM && (srcType as Enum).enumname == (tarType as Enum).enumname;
        case ADT:
            return srcType.typename == ADT && (srcType as Arbitrary).adtName == (tarType as Arbitrary).adtName;
        case TENSOR:
            return srcType.typename == TENSOR && isSubType((srcType as Tensor).typeArg, (tarType as Tensor).typeArg);
        case ANYTYPE:
            return true;
        default:
            return false;
    }
}