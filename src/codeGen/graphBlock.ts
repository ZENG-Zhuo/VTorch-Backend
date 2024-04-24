import { Database } from "../common/objectStorage";
import { FileModuleNode, FolderModuleNode } from "../common/pythonFileTypes";
import { ClassInfo, FuncInfo } from "../common/pythonObjectTypes";
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
    equals(tar: EdgeEndpoint): boolean{
        return this.toString() == tar.toString();
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
    outDegreeCount(): number{
        return Array.from(this.fTar.values()).map(es => es.length).reduce((x, y) => x+y, 0);
    }
    static readonly literalNodeType = "Literal";
}

export abstract class TypedParamBlock extends Block{
    fSrcType: Map<string, PythonType[]> = new Map();
    // only used to determine a single connected source is treated a pure value or a tuple with single value
    fSrcIsTuple: Map<string, boolean> = new Map();
    fTarType: PythonType = new pyType.Any();

    static funcNameMapping(func: FuncInfo): string{
        console.log("mapping funcname", func.name);
        return func.name.slice(0, "__init__".length) == "__init__" ? "ini" : "fwd";
    }

    addFunctionParams(func: FuncInfo, isForward: boolean) {
        let funcName = TypedParamBlock.funcNameMapping(func);
        func.parameters.forEach(param => {
            console.log("setting", funcName + '-' + param.name, "at", this.blockId);
            this.fSrcType.set(funcName + '-' + param.name, [toPythonType(param.type_hint)]);
            this.fSrcIsTuple.set(funcName + '-' + param.name, false);
            this.fSrc.set(funcName + '-' + param.name, []);
        });
        if(isForward){
            this.fTarType = toPythonType(func.return_type ? func.return_type : undefined);
        }
        console.log("in add func param ", this.fSrcType);
    }

    appendType(edgeEnd: EdgeEndpoint, value: PythonType | string): {succ: boolean, converted?: any}{
        const failed = {succ: false};
        let types = this.fSrcType.get(edgeEnd.asKey())!;
        // console.log("append type: ", edgeEnd.toString(), value);

        // first source: may or may not be the first element of the tuple
        if(types.length == 1){
            let {match: matchD, rest: restD} = pyType.deriveType(types[types.length-1], value);
            let matchW = typeof(value) == "string" ? pyType.convertTo(value, types[0]) : {succ: pyType.isSubType(value, types[0])}
            console.log(matchD, restD, matchW);
            if((!matchW.succ) && (!restD)){
                console.log("failed");
                return failed;
            }
            types.push(restD ? restD : new pyType.None());
            this.fSrcIsTuple.set(edgeEnd.asKey(), matchW.succ);
            return restD ? (matchD ? matchD : {succ: true}) : matchW;
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

    deleteEdge(source: Block, thisEdgeEnd: EdgeEndpoint, srcEdgeEnd?: EdgeEndpoint): boolean{
        if(source instanceof LiteralBlock)
            srcEdgeEnd = source.defaultEdgeEnd;
        if(!srcEdgeEnd)
            throw Error("src edge not provided");
        let edges = this.fSrc.get(thisEdgeEnd.asKey());
        if(!edges)
            throw Error("Cannot find edgeend " + thisEdgeEnd.toString());
        if(edges.length == 0)
            throw Error("Node doesn't have in-degree edge");
        if(!edges[edges.length-1].equals(srcEdgeEnd))
            return false;
        edges.pop();
        this.fSrcType.get(thisEdgeEnd.asKey())!.pop();
        if(edges.length == 0)
            this.fSrcIsTuple.set(thisEdgeEnd.asKey(), false);
        let srcTars = source.fTar.get(srcEdgeEnd.asKey())!;
        let rmIdx = srcTars.findIndex(e => e.equals(thisEdgeEnd));
        srcTars.splice(rmIdx, 1);
        return true;
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

    checkParamReady(key: string){
        let argTypes = this.fSrcType.get(key)!;
        return pyType.nullable(argTypes[argTypes.length - 1]) || (this.fSrc.get(key)!.length == 1 && this.fSrcIsTuple.get(key)!);
    }

    checkFunctionReady(func: FuncInfo): boolean{
        let asKey = (paramName: string) => `${TypedParamBlock.funcNameMapping(func)}-${paramName}`;
        let paramFilldStatus = func.parameters.map(prm => 
            this.fSrc.get(asKey(prm.name))!.length > 0 ?
                this.checkParamReady(asKey(prm.name)) :
                ((!!prm.initial_value) || prm.name == "self" || prm.power || prm.star) 
        );
        console.log(paramFilldStatus, func.parameters);
        return paramFilldStatus.reduce((x, y) => x && y, true);
    }

    abstract readyForGen(): boolean
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
        // console.log("info: ", info.functions);
        let initFunction = info.getFunctions("__init__").at(0);
        if(initFunction)
            this.addFunctionParams(initFunction, false);
        let fwdFunction = info.getFunctions("forward").at(0);
        if(fwdFunction){
            // console.log("adding forward", fwdFunction);
            this.addFunctionParams(fwdFunction, true);
        }
        console.log("after calling addFuncParams", this.fSrcType);
    }

    readyForGen(): boolean {
        let initFunction = this.blockClass.getFunctions("__init__").at(0);
        let forwardFunction = this.blockClass.getFunctions("forward").at(0);
        console.log("checking readyCodegen ", this.blockId);
        return (!initFunction || this.checkFunctionReady(initFunction)) 
                && (!forwardFunction || this.checkFunctionReady(forwardFunction));
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
    readyForGen(): boolean {
        return this.checkFunctionReady(this.blockFunc);
    }
}

export class InputBlock extends TypedParamBlock{
    constructor(blkId?: string){
        super(INPUTBLKID, blkId ? blkId : INPUTBLKID);
        this.fTarType = new pyType.Any();
    }
    readyForGen(): boolean {
        return true;
    }
}

export class OutputBlock extends TypedParamBlock{
    static readonly inputSlot = new EdgeEndpoint(OUTPUTBLKID, OUTPUTBLKID, "fwd", "input", "");
    constructor(blkId?: string){
        super(OUTPUTBLKID, blkId ? blkId : OUTPUTBLKID);
        this.fSrcType.set(OutputBlock.inputSlot.asKey(), [new pyType.Any()]);
        this.fSrc.set(OutputBlock.inputSlot.asKey(), []);
        this.fSrcIsTuple.set(OutputBlock.inputSlot.asKey(), false);
    }
    readyForGen(): boolean {
        return true;
    }
}

export class LayerGraph{
    inputBlocks: InputBlock[] = [];
    outputBlocks: OutputBlock[] = [];
    graph: Map<string, Block> = new Map();
    torchPackage?: Package;
    name: string;

    constructor(graphName: string = "MyModel"){
        this.name = graphName;
    }

    get(x: string) {return this.graph.get(x);}
    entries() {return this.graph.entries();}

    initTorchPackage(){
        const packageId = Database.findPackage("torch", "1.0.0")!;
        this.torchPackage = Database.getPackage(packageId);
    }

    addBlock(id: string, info: ClassInfo | FuncInfo, fileInfo: FileModuleNode | FolderModuleNode){
        if(info instanceof ClassInfo)
            this.graph.set(id, new LayerBlock(id, info, fileInfo));
        else this.graph.set(id, new FunctionBlock(id, info, fileInfo));
        console.log(this.graph.get(id));
    }

    connectEdge(sourceEdgeEnd: string, targetEdgeEnd: string): {succ: boolean, msg: string}{
        const sourceEnd = EdgeEndpoint.fromEdgeEndString(sourceEdgeEnd);
        const targetEnd = EdgeEndpoint.fromEdgeEndString(targetEdgeEnd);
        let srcNode = this.graph.get(sourceEnd.nodeID)!;
        let tarNode = this.graph.get(targetEnd.nodeID)!;
        if(tarNode instanceof TypedParamBlock){
            // console.log(tarNode);
            console.log(tarNode.blockId, tarNode.fSrcType);
            if(!tarNode.fSrc.has(targetEnd.asKey())){
                console.log("cannot find slot " + targetEnd.asIDKey());
                return {succ: false, msg: "cannot find slot " + targetEnd.asIDKey()};
            }
            let succ = tarNode.connectIn(srcNode, targetEnd, sourceEnd);
            if(succ)
                return {succ, msg: ""};
            else 
                return {succ, msg: "type mismatch"};
        }
        else 
            return {succ: false, msg: "target node doesn't accept edges"};
    }

    removeEdge(sourceEdgeEnd: string, targetEdgeEnd: string): {succ: boolean, msg: string}{
        console.log("removing edge ", sourceEdgeEnd, "to", targetEdgeEnd);
        const sourceEnd = EdgeEndpoint.fromEdgeEndString(sourceEdgeEnd);
        const targetEnd = EdgeEndpoint.fromEdgeEndString(targetEdgeEnd);
        let srcNode = this.graph.get(sourceEnd.nodeID)!;
        let tarNode = this.graph.get(targetEnd.nodeID)!;
        if(tarNode instanceof TypedParamBlock){
            let succ = tarNode.deleteEdge(srcNode, targetEnd, sourceEnd);
            if(succ){
                if(srcNode instanceof LiteralBlock && srcNode.outDegreeCount() == 0)
                    this.removeNode(srcNode.blockId);
                return {succ, msg: ""};
            }
            else
                return {succ, msg: "edges must be removed in reverse order of adding them"};
        }
        else 
            return {succ: false, msg: "target node doesn't accept edges"};
    }

    private clearSource(target: Block, key: string){
        let thisSlot = EdgeEndpoint.fromKeyString(target, key);
        target.fSrc.get(key)?.reverse().forEach(e => this.removeEdge(e.toString(), thisSlot.toString()));
    }

    removeNode(id: string): {succ: boolean, msg: string}{
        console.log("removing node ", id);
        if(!this.graph.has(id))
            return {succ: false, msg: id + " not found"};
        let target = this.graph.get(id)!;
        if(target.outDegreeCount() > 0){
            return {succ: false, msg: "please delete out-degree edges first"};
        }
        for(let [key, edges] of target.fSrc){
            this.clearSource(target, key);
        }
        this.graph.delete(id);
        return {succ: true, msg: ""};
    }

    updateArg(edgeEnding: string, arg: string): {succ: boolean, msg: string}{
        const targetEnd = EdgeEndpoint.fromEdgeEndString(edgeEnding);
        let newNode = new LiteralBlock(arg);
        let tarNode = this.graph.get(targetEnd.nodeID)!;
        if(tarNode instanceof TypedParamBlock){
            this.clearSource(tarNode, targetEnd.asKey());
            let ret = tarNode.connectIn(newNode, targetEnd);
            if(!tarNode.fSrc.has(targetEnd.asKey()))
                return {succ: false, msg: "cannot find arg " + targetEnd.asIDKey()};
            if(ret){
                this.graph.set(newNode.blockId, newNode);
                return {succ: true, msg: ""};
            }
            else {
                return {succ: false, msg: "argument rejected"};
            }
        }
        return {succ: false, msg: "block " + targetEnd.nodeID + " doesn't accept argument"};
    }

    addBlockByName(id: string, name: string, submodule: string[]): {succ: boolean, msg: string} {
        if(!this.torchPackage)
            this.initTorchPackage();
        if(name == INPUTBLKID){
            let newBlock = new InputBlock(id);
            this.inputBlocks.push(newBlock);
            this.graph.set(id, newBlock);
        }
        else if(name == OUTPUTBLKID){
            let newBlock = new OutputBlock(id);
            this.outputBlocks.push(newBlock);
            this.graph.set(id, newBlock);
        }
        else {
            console.log(id, name, submodule);
            const submoduleID = this.torchPackage!.getSubModule(submodule, false);
            if(typeof(submoduleID) == "undefined")
                return {succ: false, msg: "Cannot find submodule"};
            const thissubmodele = Database.getNode(submoduleID);
            let info: FuncInfo | ClassInfo | undefined;
            if(name.includes("$")) {
                let splitted = name.split("$");
                info = thissubmodele.getFunction(splitted[0]).at(parseInt(splitted[1])-1);
            }
            else
                info = thissubmodele.getClass(name);
            if(!info)
                return {succ: false, msg: "Cannot find class/function " + name};
            if(this.graph.has(id))
                return {succ: false, msg: "Block ID duplicated"};
            this.addBlock(id, info, thissubmodele);
        }
        return {succ: true, msg: ""};
    }

    initFromJSON(jsonObj: any){
        let graph: GraphJSON = jsonObj;
        for(let id of Object.keys(graph)){
            let blockInfo = graph[id];
            if(blockInfo.submodule){
                let ret = this.addBlockByName(id, blockInfo.name, blockInfo.submodule);
                if(!ret.succ){
                    throw new Error("add " + id + "failed " + ret.msg);
                }
            }
            else if(blockInfo.name == INPUTBLKID){
                let newInput = new InputBlock(id);
                this.inputBlocks.push(newInput);
                this.graph.set(id, newInput);
            }
            else if(blockInfo.name == OUTPUTBLKID){
                let newOutput = new OutputBlock(id);
                this.outputBlocks.push(newOutput);
                this.graph.set(id, newOutput);
            }
        }
        // console.log("all nodes added");
        console.log(this.graph);
        for(let id of Object.keys(graph)){
            let blockInfo = graph[id];
            let params = blockInfo.literalParams;
            for(let [name, value] of params){
                let result = this.updateArg(name, value);
                if(result.succ){
                    console.log("setting param", name, " succeed");
                }
                else {
                    throw new Error("setting param " + name + " = " + value + " failed " + result.msg)
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
                    throw new Error(ret.msg);
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
            else if(block instanceof TypedParamBlock){
                let literalParams = Array.from(block.fSrc.entries()).flatMap(([key, srcSlot]) => 
                    srcSlot.filter(edg => edg.nodeType == Block.literalNodeType)
                        .map(edg => [
                                `${block.blockType}-${block.blockId}-${key}`, 
                                (this.graph.get(edg.nodeID)! as LiteralBlock).getText()
                            ] as [string, string]
                        )
                );
                let body = block.encodeNoneLitEdge();
                body.submodule = (block instanceof LayerBlock ? block.fileInfo.relativePath : 
                                    block instanceof FunctionBlock ? block.fileInfo.relativePath :
                                    undefined
                );
                body.literalParams = literalParams;
                ret[block.blockId] = body;
            }
            else{
                ret[block.blockId] = block.encodeNoneLitEdge();
            }
        }
        return ret;
    }

    readyForGen(): {succ: boolean, msg: string}{
        let srcEdgNum = new Map(Array.from(this.graph.entries()).map(
            ([blkid, blkBody]) => [blkid, Array.from(blkBody.fSrc.entries()).filter(([_, y]) => y.length > 0).length])
        );
        console.log(srcEdgNum);
        let zeroSrcId = Array.from(srcEdgNum.entries()).filter(([_, y]) => y == 0).map(([x, _]) => x);
        let ret: string[] = [];
        // console.log(srcEdgNum);
        while(zeroSrcId.length > 0){
            let id = zeroSrcId.pop()!;
            let blk = this.graph.get(id)!;
            ret.push(id);
            console.log(id);
            Array.from(blk.fTar.entries()).forEach(([_, edges]) => 
                edges.forEach(e => {
                    srcEdgNum.set(e.nodeID, (srcEdgNum.get(e.nodeID)!)-1);
                    if(srcEdgNum.get(e.nodeID) == 0)
                        zeroSrcId.push(e.nodeID);
                }
            ));
            console.log(srcEdgNum);
        }
        console.log(Array.from(this.graph.keys()));
        console.log(ret);
        // console.log("topo sorted", ret);
        if(ret.length != this.graph.size)
            return {succ: false, msg: "Detects rings in the graph"};


        for(let [id, blk] of this.graph.entries())
            if(blk instanceof LiteralBlock)
                continue;
            else if(blk instanceof TypedParamBlock)
                if(!blk.readyForGen())
                    return {succ: false, msg: `Node ${id} does not have enough arguments`};
        return {succ: true, msg: ""};
    }
}