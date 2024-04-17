import { Database } from "../common/objectStorage";
import { FileModuleNode, FolderModuleNode } from "../common/pythonFileTypes";
import { ClassInfo, TypeInfo } from "../common/pythonObjectTypes";
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
    
    // avgpool-node1-fwd-input
    // avgpool-node1-ini-name-1
    // avgpool-node1-fwd-return
    constructor(edgeEndName: string){
        const splitted = edgeEndName.split('-');
        this.nodeType = splitted[0];
        this.nodeID = splitted[1];
        this.funcName = splitted[2]; 
        this.paramName = splitted[3]; 
        this.slotIdx = splitted.length > 4 ? splitted[4] : "";
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

export class LiteralBlock extends Block{
    original: string;
    converted: any = undefined;
    constantType?: PythonType;
    readonly defaultEdgeEnd;
    constructor(_value: string){
        super(Block.literalNodeType);
        this.original = _value;
        this.defaultEdgeEnd = new EdgeEndpoint(`${this.blockType}-${this.blockId}-fwd-return`);
    }
    getText(): string{
        return (typeof(this.converted) == "undefined") ? this.original: String(this.converted);
    }
}

export class LayerBlock extends Block{
    fileInfo: FileModuleNode | FolderModuleNode
    blockClass: ClassInfo; 
    fSrcType: Map<string, PythonType[]> = new Map();
    fTarType: PythonType;

    constructor(id: string, info: ClassInfo, _fileInfo: FileModuleNode | FolderModuleNode){
        super(info.name, id);
        this.blockClass = info;
        this.fileInfo = _fileInfo;

        let initFunction = info.functions.find(f => f.name == "__init__");
        if(initFunction){
            initFunction.parameters.forEach(param => {
                this.fSrcType.set("ini-" + param.name, [toPythonType(param.type_hint)]);
                this.fSrc.set("ini-" + param.name, []);
            });
        }
        let fwdFunction = info.functions.find(f => f.name == "forward")!;
        fwdFunction.parameters.forEach(param => {
            this.fSrcType.set("fwd-" + param.name, [toPythonType(param.type_hint)]);
            this.fSrc.set("fwd-" + param.name, []);
        });
        this.fTarType = toPythonType(fwdFunction.return_type ? fwdFunction.return_type : undefined);
    }

    connectIn(source: Block, thisEdgeEnd: EdgeEndpoint, srcEdgeEnd?: EdgeEndpoint): boolean{
        let value: string | PythonType;
        if(source instanceof LiteralBlock){
            value = source.getText();
        }
        else if(source instanceof LayerBlock){
            value = source.fTarType;
            if(value.typename == pyType.TUPLETYPE && srcEdgeEnd && srcEdgeEnd.slotIdx != ""){
                value = (value as pyType.Tuple).inners[parseInt(srcEdgeEnd.slotIdx) - 1];
            }
        }
        else{
            return false;
        }
        let types = this.fSrcType.get(thisEdgeEnd.asKey())!;
        console.log("connect In: trying to fit", value, "into", types[types.length-1]);
        let {match, rest} = pyType.deriveType(types[types.length-1], value, true);
        if(types.length == 1){
            let fullMatch = pyType.deriveType(types[0], value, false);
            if(rest && fullMatch.rest)
                rest = new pyType.Union([rest, fullMatch.rest]);
            else if(!rest){
                rest = fullMatch.rest;
                match = fullMatch.match;
            }
        }
        console.log("Derived result", rest);
        if(rest){
            types.push(rest);
            if(source instanceof LiteralBlock){
                source.converted = match?.converted;
                source.addTar(source.defaultEdgeEnd, thisEdgeEnd);
                this.addSrc(thisEdgeEnd, source.defaultEdgeEnd);
                return true;
            }
            else if(source instanceof LayerBlock && srcEdgeEnd){
                source.addTar(srcEdgeEnd, thisEdgeEnd);
                this.addSrc(thisEdgeEnd, srcEdgeEnd);
                return true;
            }
        }
        return false;
    }
}

export class FunctionBlock extends Block{

}

export class InputBlock extends Block{
    constructor(){super(INPUTBLKID, INPUTBLKID);}
}
export class OutputBlock extends Block{
    constructor(){super(OUTPUTBLKID, OUTPUTBLKID);}
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
        const sourceEnd = new EdgeEndpoint(sourceEdgeEnd);
        const targetEnd = new EdgeEndpoint(targetEdgeEnd);
        let onSucceed = () => {
            this.graph.get(sourceEnd.nodeID)?.addTar(sourceEnd, targetEnd);
            this.graph.get(targetEnd.nodeID)?.addSrc(targetEnd, sourceEnd);
            return {succ: true, msg: ""};
        }
        if(sourceEnd.nodeID == INPUTBLKID || sourceEnd.nodeID == OUTPUTBLKID || targetEnd.nodeID == INPUTBLKID || targetEnd.nodeID == OUTPUTBLKID){
            return onSucceed();
        }
        else{
            let srcNode = this.graph.get(sourceEnd.nodeID)!;
            let tarNode = this.graph.get(targetEnd.nodeID)!;
            if(tarNode instanceof LayerBlock){
                let succ = tarNode.connectIn(srcNode, targetEnd, sourceEnd);
                if(succ)
                    return {succ, msg: ""};
                else 
                    return {succ, msg: "type mismatch"};
            }
            else 
                return {succ: false, msg: "target node doesn't accept edges"};
        }
    }

    fillArg(edgeEnding: string, arg: string): {succ: boolean, msg: string}{
        const targetEnd = new EdgeEndpoint(edgeEnding);
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
        console.log("all nodes added");
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