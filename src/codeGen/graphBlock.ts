import { Database } from "../common/objectStorage";
import { FileModuleNode, FolderModuleNode } from "../common/pythonFileTypes";
import { ClassInfo, FuncInfo, TypeInfo } from "../common/pythonObjectTypes";
import { Package } from "../common/pythonPackageType";
import { PythonType, toPythonType } from "./pythonTypes";
import * as pyType from "./pythonTypes"; 

export const INPUTBLKID = "input";
export const OUTPUTBLKID = "output";

export class EdgeEndpoint{
    readonly nodeType: string
    readonly nodeID: string
    readonly funcName: string 
    readonly paramName: string 
    readonly slotIdx: string

    constructor(nodeType: string, nodeID: string, funcName: string, paramName: string, slotIdx: string){
        this.nodeType = nodeType;
        this.nodeID = nodeID;
        this.funcName = funcName; 
        this.paramName = paramName; 
        this.slotIdx = slotIdx;
    }
    
    // avgpool-node1-fwd-input
    // avgpool-node1-ini-name-1
    // avgpool-node1-fwd-return
    static fromEdgeEndString(edgeEndName: string){
        const splitted = edgeEndName.split('-');
        return new EdgeEndpoint(splitted[0], splitted[1], splitted[2], splitted[3], splitted.length > 4 ? splitted[4] : "");
    }

    //key = fwd-input
    static fromKeyString(block: Block, key: string){
        const splitted = key.split('-');
        return new EdgeEndpoint(block.blockType, block.blockId, splitted[0], splitted[1], "");
    }

    asKey(): string{
        return this.funcName + "-" + this.paramName;
    }
    asIDKey(): string{
        return this.nodeID + "-" + this.funcName + "-" + this.paramName;
    }
    toString(): string{
        return this.nodeType + "-" + this.nodeID + "-" + this.funcName + "-" + this.paramName + "-" + this.slotIdx;
    }
}

interface BlockJSON{
    literalParams: [name: string, value: string][],
    name: string,
    submodule?: string[],
    source: [thisSlot: string, srcSlot: string][]
    target: [thisSlot: string, tarSlot: string][]
}
interface GraphJSON{
    [id: string] : BlockJSON
}

export abstract class Block{
    blockId: string;
    blockType: string;
    fSrc: Map<string, EdgeEndpoint[]> = new Map();
    fTar: Map<string, EdgeEndpoint[]> = new Map();
    constructor(_blockType: string, _blockId?: string){
        this.blockType = _blockType;
        this.blockId = _blockId ? _blockId : Block.genBlockID();
    }

    static blockCount = 0;
    static genBlockID(): string{
        this.blockCount += 1;
        return `autogen$Block${this.blockCount}`;
    }
    addSrc(thisEnd: EdgeEndpoint, src: EdgeEndpoint){
        const key = thisEnd.asKey();
        if(this.fSrc.has(key)){
            this.fSrc.get(key)?.push(src);
        }
        else{
            this.fSrc.set(key, [src]);
        }
    }
    addTar(thisEnd: EdgeEndpoint, tar: EdgeEndpoint){
        const key = thisEnd.asKey();
        if(this.fTar.has(key)){
            this.fTar.get(key)?.push(tar);
        }
        else{
            this.fTar.set(key, [tar]);
        }
    }
    encodeNoneLitEdge(): BlockJSON{
        let source = Array.from(this.fSrc.entries()).flatMap(([key, srcSlot]) => 
            srcSlot.filter(edg => edg.nodeType != Block.literalNodeType)
                .map(edg => [
                        `${this.blockType}-${this.blockId}-${key}`, 
                        edg.toString()
                    ] as [string, string]
                )
        );
        let target = Array.from(this.fTar.entries()).flatMap(([key, tarSlot]) => 
            tarSlot.map(edg => [
                        `${this.blockType}-${this.blockId}-${key}`, 
                        edg.toString()
                    ] as [string, string]
                )
        );
        return {name: this.blockType, literalParams: [], source, target};
    }
    nonLitSources(): EdgeEndpoint[]{
        return Array.from(this.fSrc.values()).flatMap((srcSlot) => 
            srcSlot.filter(edg => edg.nodeType != Block.literalNodeType)
        );
    }
    static readonly literalNodeType = "Literal";
}

export abstract class TypedParamBlock extends Block{
    fSrcType: Map<string, PythonType[]> = new Map();
    // only used to determine a single connected source is treated a pure value or a tuple with single value
    fSrcIsTuple: Map<string, boolean> = new Map();
    fTarType: PythonType = new pyType.Any();

    static funcNameMapping(func: FuncInfo): string{
        return func.name == "__init__" ? "ini" : "fwd";
    }

    addFunctionParams(func: FuncInfo, isForward: boolean) {
        let funcName = TypedParamBlock.funcNameMapping(func);
        func.parameters.forEach(param => {
            this.fSrcType.set(funcName + '-' + param.name, [toPythonType(param.type_hint)]);
            this.fSrcIsTuple.set(funcName + '-' + param.name, false);
            this.fSrc.set(funcName + '-' + param.name, []);
        });
        if(isForward){
            this.fTarType = toPythonType(func.return_type ? func.return_type : undefined);
        }
    }

    appendType(edgeEnd: EdgeEndpoint, value: PythonType | string): {succ: boolean, converted?: any}{
        const failed = {succ: false};
        let types = this.fSrcType.get(edgeEnd.asKey())!;
        // console.log("append type: ", edgeEnd.toString(), value);

        // first source: may or may not be the first element of the tuple
        if(types.length == 1){
            let {match: matchD, rest: restD} = pyType.deriveType(types[types.length-1], value);
            let matchW = typeof(value) == "string" ? pyType.convertTo(value, types[0]) : {succ: pyType.isSubType(value, types[0])}
            // console.log(matchD, restD, matchW);
            if(!matchW.succ && !restD)
                return failed;
            types.push(restD ? restD : new pyType.None());
            this.fSrcIsTuple.set(edgeEnd.asKey(), matchW.succ);
            return matchD ? matchD : matchW;
        }
        // must be one element in the tuple
        else {
            let {match: matchD, rest: restD} = pyType.deriveType(types[types.length-1], value);
            if(!restD)
                return failed;
            types.push(restD);
            return matchD ? matchD : {succ: true};
        }
    }

    connectIn(source: Block, thisEdgeEnd: EdgeEndpoint, srcEdgeEnd?: EdgeEndpoint): boolean{
        let value: string | PythonType;
        if(source instanceof LiteralBlock){
            value = source.getText();
        }
        else if(source instanceof TypedParamBlock){
            value = source.fTarType;
            if(value.typename == pyType.TUPLETYPE && srcEdgeEnd && srcEdgeEnd.slotIdx != ""){
                value = (value as pyType.Tuple).inners[parseInt(srcEdgeEnd.slotIdx) - 1];
            }
        }
        else{
            return false;
        }
        let ret = this.appendType(thisEdgeEnd, value);
        console.log("append result: ", ret);
        if(ret.succ){
            if(source instanceof LiteralBlock){
                source.updateConverted(ret);
                source.addTar(source.defaultEdgeEnd, thisEdgeEnd);
                this.addSrc(thisEdgeEnd, source.defaultEdgeEnd);
                return true;
            }
            else if(srcEdgeEnd){
                source.addTar(srcEdgeEnd, thisEdgeEnd);
                this.addSrc(thisEdgeEnd, srcEdgeEnd);
                return true;
            }
        }
        return false;
    }

    gratherArgs(funcName: string): [string, EdgeEndpoint | EdgeEndpoint[]][]{
        let ret = Array.from(this.fSrc.entries())
                    .filter(([key, edges]) => EdgeEndpoint.fromKeyString(this, key).funcName == funcName && edges.length > 0)
                    .map(([key, edges]) => {
                        let encodedKey = EdgeEndpoint.fromKeyString(this, key);
                        // console.log(key, encodedKey.toString(), edges.length, this.fSrcIsTuple.get(key))
                        let edgVal = 
                            (edges.length == 1 && this.fSrcIsTuple.get(key) == true) ? edges[0] : edges;
                        
                        return [encodedKey.paramName, edgVal] as [string, EdgeEndpoint | EdgeEndpoint[]];
                    });
        // console.log("gathered args of", funcName, ret);
        return ret;
    }

    // abstract readyForGen(): boolean
}

export class LiteralBlock extends Block{
    original: string;
    converted: any = undefined;
    constantType?: PythonType;
    readonly defaultEdgeEnd;
    constructor(_value: string){
        super(Block.literalNodeType);
        this.original = _value;
        this.defaultEdgeEnd = new EdgeEndpoint(this.blockType, this.blockId, "fwd", "return", "");
    }
    getText(): string{
        return (typeof(this.converted) == "undefined") ? this.original: String(this.converted);
    }
    updateConverted(upd: {converted?: any}){
        if(typeof(upd.converted) != "undefined")
            this.converted = upd.converted;
    }
}

export class LayerBlock extends TypedParamBlock{
    fileInfo: FileModuleNode | FolderModuleNode;
    blockClass: ClassInfo; 

    constructor(id: string, info: ClassInfo, _fileInfo: FileModuleNode | FolderModuleNode){
        super(info.name, id);
        this.blockClass = info;
        this.fileInfo = _fileInfo;

        let initFunction = info.functions.find(f => f.name == "__init__");
        if(initFunction)
            this.addFunctionParams(initFunction, false);
        let fwdFunction = info.functions.find(f => f.name == "forward");
        if(fwdFunction)
            this.addFunctionParams(fwdFunction, true);
    }
}

export class FunctionBlock extends TypedParamBlock{
    fileInfo: FileModuleNode | FolderModuleNode
    blockFunc: FuncInfo;
    
    constructor(id: string, info: FuncInfo, _fileInfo: FileModuleNode | FolderModuleNode){
        super(info.name, id);
        this.blockFunc = info;
        this.fileInfo = _fileInfo;
        this.addFunctionParams(info, true);
    }
}

export class InputBlock extends TypedParamBlock{
    constructor(){
        super(INPUTBLKID, INPUTBLKID);
        this.fTarType = new pyType.Any();
    }
}
export class OutputBlock extends TypedParamBlock{
    static readonly inputSlot = new EdgeEndpoint(OUTPUTBLKID, OUTPUTBLKID, "fwd", "input", "");
    constructor(){
        super(OUTPUTBLKID, OUTPUTBLKID);
        this.fSrcType.set(OutputBlock.inputSlot.asKey(), [new pyType.Any()]);
    }
}

export class LayerGraph{
    inputBlock = new InputBlock();
    outputBlock = new OutputBlock();
    graph: Map<string, Block> = new Map([[INPUTBLKID, this.inputBlock], [OUTPUTBLKID, this.outputBlock]]);
    torchPackage?: Package;

    get(x: string) {return this.graph.get(x);}
    entries() {return this.graph.entries();}

    initTorchPackage(){
        const packageId = Database.findPackage("torch", "1.0.0")!;
        this.torchPackage = Database.getPackage(packageId);
    }

    addBlock(id: string, blockClass: ClassInfo, fileInfo: FileModuleNode | FolderModuleNode){
        this.graph.set(id, new LayerBlock(id, blockClass, fileInfo));
    }

    connectEdge(sourceEdgeEnd: string, targetEdgeEnd: string): {succ: boolean, msg: string}{
        const sourceEnd = EdgeEndpoint.fromEdgeEndString(sourceEdgeEnd);
        const targetEnd = EdgeEndpoint.fromEdgeEndString(targetEdgeEnd);
        let srcNode = this.graph.get(sourceEnd.nodeID)!;
        let tarNode = this.graph.get(targetEnd.nodeID)!;
        if(tarNode instanceof TypedParamBlock){
            let succ = tarNode.connectIn(srcNode, targetEnd, sourceEnd);
            if(succ)
                return {succ, msg: ""};
            else 
                return {succ, msg: "type mismatch"};
        }
        else 
            return {succ: false, msg: "target node doesn't accept edges"};
    }

    fillArg(edgeEnding: string, arg: string): {succ: boolean, msg: string}{
        const targetEnd = EdgeEndpoint.fromEdgeEndString(edgeEnding);
        let newNode = new LiteralBlock(arg);
        let tarNode = this.graph.get(targetEnd.nodeID)!;
        if(tarNode instanceof LayerBlock){
            let ret = tarNode.connectIn(newNode, targetEnd);
            if(ret){
                this.graph.set(newNode.blockId, newNode);
                return {succ: true, msg: ""};
            }
        }
        return {succ: false, msg: ""};
    }

    addBlockByName(id: string, name: string, submodule: string[]): {succ: boolean, msg: string} {
        if(!this.torchPackage)
            this.initTorchPackage();
        console.log(id, name, submodule);
        const submoduleID = this.torchPackage!.getSubModule(submodule, false);
        if(typeof(submoduleID) == "undefined")
            return {succ: false, msg: "Cannot find submodule"};
        const thissubmodele = Database.getNode(submoduleID);
        const classInfo = thissubmodele.getClass(name);
        if(typeof(classInfo) == "undefined")
            return {succ: false, msg: "Cannot find class"};
        if(this.graph.has(id))
            return {succ: false, msg: "Block ID duplicated"};
        this.addBlock(id, classInfo, thissubmodele);
        return {succ: true, msg: ""};
    }

    initFromJSON(jsonObj: any){
        let graph: GraphJSON = jsonObj;
        for(let id of Object.keys(graph)){
            if(id == INPUTBLKID || id == OUTPUTBLKID)
                continue;
            let blockInfo = graph[id];
            if(blockInfo.submodule){
                let ret = this.addBlockByName(id, blockInfo.name, blockInfo.submodule);
                if(!ret.succ){
                    console.error("add " + id + "failed", ret.msg);
                }
            }
        }
        // console.log("all nodes added");
        console.log(this.graph);
        for(let id of Object.keys(graph)){
            let blockInfo = graph[id];
            let params = blockInfo.literalParams;
            for(let [name, value] of params){
                let result = this.fillArg(name, value);
                if(result.succ){
                    console.log("setting param", name, " succeed");
                }
                else {
                    console.error("setting param", name, "=", value, "failed", result.msg)
                }
            }
            console.log("all params added in ", id);
            
            let sources = blockInfo.source;
            for(let [thisSlot, srcSlot] of sources){
                console.log("find edge ", srcSlot, " to ", thisSlot);
                let ret = this.connectEdge(srcSlot, thisSlot);
                if(ret.succ){
                    console.log("edge setup succeed");
                }
                else {
                    console.error(ret.msg);
                }
            }
            console.log("all edges add in ", id);
        }
        console.log(this.graph);
    }
    toJSON(): GraphJSON{
        let ret: GraphJSON = {};
        for(let [id, block] of this.graph){
            if(block instanceof LiteralBlock)
                continue;
            else if(block instanceof LayerBlock){
                let literalParams = Array.from(block.fSrc.entries()).flatMap(([key, srcSlot]) => 
                    srcSlot.filter(edg => edg.nodeType == Block.literalNodeType)
                        .map(edg => [
                                `${block.blockType}-${block.blockId}-${key}`, 
                                (this.graph.get(edg.nodeID)! as LiteralBlock).getText()
                            ] as [string, string]
                        )
                );
                let body = block.encodeNoneLitEdge();
                body.submodule = block.fileInfo.relativePath;
                body.literalParams = literalParams;
                ret[block.blockId] = body;
            }
            else{
                ret[block.blockId] = block.encodeNoneLitEdge();
            }
        }
        return ret;
    }
}

export const globalLayerGraph = new LayerGraph();