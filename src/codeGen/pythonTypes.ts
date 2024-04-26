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
    constructor(_inner: PythonType) {
        this.typename = LISTTYPE;
        this.inner = _inner;
    }
}

export const TUPLETYPE = "Tuple";
export class Tuple implements PythonType {
    readonly typename: string;
    readonly inners: PythonType[];
    constructor(_inners: PythonType[]) {
        this.typename = TUPLETYPE;
        this.inners = _inners;
    }
}

export const OPTIONAL = "Optional";
export class Optional implements PythonType {
    readonly typename: string;
    readonly inner: PythonType;
    constructor(_inner: PythonType) {
        this.typename = OPTIONAL;
        this.inner = _inner;
    }
}

export const UNIONTYPE = "Union";
export class Union implements PythonType {
    readonly typename: string;
    readonly alters: PythonType[];
    constructor(_alters: PythonType[]) {
        this.typename = UNIONTYPE;
        this.alters = _alters;
    }
}

export const VARIADIC = "Variadic";
export class Variadic implements PythonType {
    readonly typename: string;
    readonly inner: PythonType;
    constructor(_inner: PythonType) {
        this.typename = VARIADIC;
        this.inner = _inner;
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

export const NONETYPE = "None";
export class None implements PythonType{
    readonly typename: string;
    constructor(){this.typename = NONETYPE;}
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

export const ANYTYPE = "Any";
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
        return new Union([new Integer(), new Tuple([new Integer(), new Variadic(new Integer())])]);
    }
    matchresult = /_size_(\d)+_opt_t/g.exec(typeName);
    if (matchresult) {
        return new Union([new Optional(new Integer()), createFixLenTuple(parseInt(matchresult[1]), () => new Optional(new Integer()))]);
    }
    if (typeName == "_size_any_opt_t") {
        return new Union([new Optional(new Integer()), new Tuple([new Optional(new Integer()), new Variadic(new Optional(new Integer()))])]);
    }
    matchresult = /_ratio_(\d)+_t/g.exec(typeName);
    if (matchresult) {
        return new Union([new Float(), createFixLenTuple(parseInt(matchresult[1]), () => new Float())]);
    }
    if (typeName == "_ratio_any_t") {
        return new Union([new Float(), new Tuple([new Float(), new Variadic(new Float())])]);
    }
    if (typeName == "_tensor_list_t") {
        return new Union([new Tensor(), new Tuple([new Tensor(), new Variadic(new Tensor())])]);
    }
    if (typeName == "_maybe_indices_t") {
        return new Union([new Tensor(), new Tuple([new Tensor(), new Tensor()])]);
    }
    if (typeName == "_size"){
        return new Union([new List(new Integer()), new Tuple([new Integer(), new Variadic(new Integer())])]);
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
        case "Boolean":
            return new Boolean();
        case FLOATTYPE:
            return new Float();
        case LISTTYPE:
        case "Sequence":
            if (typeinfo.getSubtypes().length == 1)
                return new List(toPythonType(typeinfo.getSubtypes()[0]));
            else
                throw "toPythonType error: list type " + typeinfo.toString() + " has more than 1 arguments";
        case TUPLETYPE: {
            let inners = typeinfo.getSubtypes();
            if(inners.length > 1 && inners[inners.length-1].getType() == VARIADIC){
                let others = inners.slice(0, -1).map(toPythonType);
                return new Tuple([...others, new Variadic(others[others.length - 1])]);
            }
            else
                return new Tuple(typeinfo.getSubtypes().map(toPythonType));
        }
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
        case NONETYPE:
            return new None();       
        case VARIADIC:
            return new Variadic(new Any());
        case TENSOR:
            return new Tensor(typeinfo.getSubtypes().length == 1 ? toPythonType(typeinfo.getSubtypes()[0]) : new Any());
        case ANYTYPE:
        case "any":
            return new Any();
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

export function convertTo(textString: string, targetType: PythonType): {succ: boolean, converted: any, actualType?: PythonType}{
    let tmp;
    const failed = {succ: false, converted: null, actualType: undefined};
    const str = textString.trim();
    // console.log("checking", textString, targetType);
    switch (targetType.typename) {
        case STRINGTYPE:
            if((str[0] == '"' && str[str.length - 1] == '"') || (str[0] == '\'' && str[str.length - 1] == '\'')){
                let splitted = splitVal(str);
                if(splitted && splitted.length == 1)    //reject "x", "y"
                    return {succ: true, converted: str, actualType: new String()};
            }
            return failed;
        case INTTYPE:{
            const num = Number(str);
            if(Number.isNaN(num) || !Number.isInteger(num)){
                return failed;
            }
            else {return {succ: true, converted: num, actualType: new Integer()};}
        }
        case FLOATTYPE:{
            const num = Number(str);
            if(Number.isNaN(tmp)){
                return failed;
            }
            else return {succ: true, converted: num, actualType: new Float()};
        }
        case BOOLTYPE:
            if(str == "True" || str == "true")
                return {succ: true, converted: "True", actualType: new Boolean()};
            else if(str == "False" || str == "false")
                return {succ: true, converted: "False", actualType: new Boolean()};
            else return failed;
        case LISTTYPE:
            if(str[0] == "[" && str[str.length - 1] == "]"){
                let splitted = splitVal(str.substring(1, str.length-1));
                if(splitted instanceof Array){
                    let innertype = (targetType as List).inner;
                    let transResult = splitted.map(x => convertTo(x, innertype));
                    let succ = transResult.reduce((x, y) => x && y.succ, true);
                    return succ ? {succ, converted: str, actualType: new List(innertype)} : failed;
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
                            );
                            let succ = transResult.reduce((x, y) => x && y.succ, true);
                            return succ ? {succ, converted: str, actualType: new Tuple(transResult.map(x => x.actualType!))} : failed;
                        }
                    }
                    else {                                                      //Tuple[T, ...]
                        if(splitted.length < innertypes.length - 1)
                            return failed;
                        else {
                            let transResult = splitted.map((x, i) => 
                                i < innertypes.length - 1 ? convertTo(x, innertypes[i]) : convertTo(x, innertypes[innertypes.length - 1])
                            );
                            let succ = transResult.reduce((x, y) => x && y.succ, true);
                            return succ ? {succ, converted: str, actualType: new Tuple(transResult.map(x => x.actualType!))} : failed;
                        }
                    }
                }
            }
            return failed;
        case OPTIONAL:
            if(str == "None")
                return {succ: true, converted: str, actualType: new None()};
            else return convertTo(str, (targetType as Optional).inner);
        case NONETYPE:
            if(str == "None")
                return {succ: true, converted: str, actualType: new None()};
            return failed;
        case VARIADIC:
            return convertTo(str, (targetType as Variadic).inner);
        case UNIONTYPE: {
            let alters = (targetType as Union).alters.map(x => convertTo(str, x));
            let succ = alters.reduce((x, y) => x || y.succ, false);
            return succ ? {succ, converted: str, actualType: alters.find(x => x.succ)?.actualType} : failed;
        }
        case TENSOR: {
            const tensorConsRegex = /^\s*(torch\.)?[tT]ensor\((.*)\)\s*$/g;
            let matchRet = tensorConsRegex.exec(str);
            if(matchRet){
                let args = splitVal(matchRet[2]);
                if(args instanceof Array){
                    let arg1ListCheck = convertTo(args[0], new List((targetType as Tensor).typeArg));
                    if(arg1ListCheck.succ)
                        return {succ: true, converted: matchRet[1] ? str : "torch." + str, actualType: new Tensor()};
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
                    return {succ: true, converted: matchRet[1] ? str : "torch." + str, actualType: targetType};
                }
                else return failed;
            }
        }
        case ANYTYPE: 
            return {succ: true, converted: str, actualType: new Any()};
        default:
            return failed;
    }
}

export function isSubType(srcType: PythonType, tarType: PythonType): boolean{
    // console.log(tarType);
    if(srcType.typename == ANYTYPE)
        return true;
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
                    return inners[inners.length - 1];
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
            return isSubType(srcType, (tarType as Optional).inner) || isSubType(srcType, new None()) || 
                (srcType.typename == OPTIONAL && isSubType((srcType as Optional).inner, (tarType as Optional).inner));
        case VARIADIC:
            if(srcType.typename == VARIADIC){
                return isSubType((srcType as Variadic).inner, (tarType as Variadic).inner);
            }
            else{
                return isSubType(srcType, (tarType as Variadic).inner);
            }
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
        case NONETYPE:
            return srcType.typename == NONETYPE;
        case TENSOR:
            return srcType.typename == TENSOR && isSubType((srcType as Tensor).typeArg, (tarType as Tensor).typeArg);
        case ANYTYPE:
            return true;
        default:
            return false;
    }
}

//only may unzip first level tuple when originType has length 1, i.e. originType = [Tuple(A, B, C)] => [B, C]
export function deriveType(originType: PythonType | undefined, delta: string | PythonType): {match?: {succ: boolean, converted: any, actualType?: PythonType}, rest: PythonType | undefined}{
    const failed = {rest: undefined};
    if(!originType)
        return failed;
    let convertAsAtomicType: ((org: PythonType) => {match?: {succ: boolean, converted: any, actualType?: PythonType}, rest: PythonType | undefined}) = (org) => {
        if(typeof(delta) == "string"){
            let whole = convertTo(delta, org);
            if(whole.succ){
                return {match: whole, rest: new None()};
            }
            else
                return failed;
        }
        else {
            let whole = isSubType(delta, org);
            return whole ? {rest: new None()} : failed;
        }
    }

    // console.log("deriving", originType, doUnzip);
    switch (originType.typename){
        case TUPLETYPE:{
            let inners = (originType as Tuple).inners;
            if(inners.length == 0)
                return failed;
            let first = convertAsAtomicType(inners[0]);
            if(!first.rest)
                return failed;
            let leftOver: PythonType[] = (inners[0].typename == VARIADIC) ? inners : inners.slice(1);
            return {match: first.match, rest: new Tuple(leftOver)};
        }
        case OPTIONAL:{
            let inner = (originType as Optional).inner;
            return deriveType(inner, delta);
        }
        case UNIONTYPE: {
            let alters = (originType as Union).alters;
            let innerResults = alters.map(x => deriveType(x, delta));
            let filterNotUndef = innerResults.map(({rest}) => rest).filter((x): x is PythonType => !!x);
            // console.log(filterNotUndef);
            if(filterNotUndef.length > 1)
                return {match: innerResults.find(({rest}) => !!rest)?.match, rest: new Union(filterNotUndef)};
            else if(filterNotUndef.length == 1)
                return {match: innerResults.find(({rest}) => !!rest)?.match, rest: filterNotUndef[0]};
            return failed;
        }
        case ANYTYPE:{
            let ret = convertAsAtomicType(originType);
            return {match: ret.match, rest: new Any()};
        }
        default:
            return failed;
    }
}

export function nullable(target: PythonType): boolean{
    switch(target.typename){
        case UNIONTYPE:
            return (target as Union).alters.map(x => nullable(x)).reduce((x, y) => x || y, false);
        case OPTIONAL:
            return nullable((target as Optional).inner);
        case TUPLETYPE:{
            let tar = target as Tuple;
            return tar.inners.length == 0 || tar.inners[0].typename == VARIADIC;
        }
        default:
            return false;
    }
}