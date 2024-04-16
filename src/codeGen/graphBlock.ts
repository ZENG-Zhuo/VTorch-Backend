import { Database } from "../common/objectStorage";
import { FileModuleNode, FolderModuleNode } from "../common/pythonFileTypes";
import { ClassInfo, TypeInfo } from "../common/pythonObjectTypes";
import { Package } from "../common/pythonPackageType";
import { PythonType, toPythonType } from "./pythonTypes";
import * as pyType from "./pythonTypes"; 

const INPUTBLKID = "input";
const OUTPUTBLKID = "output";

class EdgeEndpoint{
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
        return this.funcName + "-" + this.paramName + "-" + this.slotIdx;
    }
    
}

abstract class Block{
    blockId: string;
    fSrc: Map<string, string[]> = new Map();
    fTar: Map<string, string[]> = new Map();
    constructor(_blockId?: string){
        if(_blockId)
            this.blockId = _blockId;
        else
            this.blockId = Block.genBlockID();
    }

    static blockCount = 0;
    static genBlockID(): string{
        this.blockCount += 1;
        return `autogen$Block${this.blockCount}`;
    }
    addSrc(key: string, blkId: string){
        if(this.fSrc.has(key)){
            this.fSrc.get(key)?.push(blkId);
        }
        else{
            this.fSrc.set(key, [blkId]);
        }
    }
    addTar(key: string, blkId: string){
        if(this.fTar.has(key)){
            this.fTar.get(key)?.push(blkId);
        }
        else{
            this.fTar.set(key, [blkId]);
        }
    }
}

class LiteralBlock extends Block{
    original: string;
    converted: any = undefined;
    constantType?: PythonType;
    readonly defaultEdgeEnd;
    constructor(_value: string){
        super();
        this.original = _value;
        this.defaultEdgeEnd = new EdgeEndpoint(`Literal-${this.blockId}-fwd-return`);
    }
}

class LayerBlock extends Block{
    fileInfo: FileModuleNode | FolderModuleNode
    blockClass: ClassInfo; 
    fSrcType: Map<string, PythonType[]> = new Map();
    fTarType: PythonType;

    constructor(id: string, info: ClassInfo, _fileInfo: FileModuleNode | FolderModuleNode){
        super(id);
        this.blockClass = info;
        this.fileInfo = _fileInfo;

        let initFunction = info.functions.find(f => f.name == "__init__")!;
        initFunction.parameters.forEach(param => {
            this.fSrcType.set("ini-" + param.name + "-", [toPythonType(param.type_hint)]);
            this.fSrc.set("ini-" + param.name + "-", []);
        });
        let fwdFunction = info.functions.find(f => f.name == "forward")!;
        fwdFunction.parameters.forEach(param => {
            this.fSrcType.set("fwd-" + param.name + "-", [toPythonType(param.type_hint)]);
            this.fSrc.set("fwd-" + param.name + "-", []);
        });
        this.fTarType = toPythonType(fwdFunction.return_type ? fwdFunction.return_type : undefined);
    }

    connectIn(source: Block, thisEdgeEnd: EdgeEndpoint, srcEdgeEnd?: EdgeEndpoint): boolean{
        let value: string | PythonType;
        if(source instanceof LiteralBlock){
            value = source.converted ? source.converted : source.original;
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
        console.log(thisEdgeEnd);
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
            this.addSrc(thisEdgeEnd.asKey(), source.blockId);
            if(source instanceof LiteralBlock){
                source.converted = match?.converted;
                source.addTar(source.defaultEdgeEnd.asKey(), this.blockId);
                return true;
            }
            else if(source instanceof LayerBlock && srcEdgeEnd){
                source.addTar(srcEdgeEnd.asKey(), this.blockId);
                return true;
            }
        }
        return false;
    }
}

class FunctionBlock extends Block{

}

class InputBlock extends Block{
    constructor(){super(INPUTBLKID);}
}
class OutputBlock extends Block{
    constructor(){super(OUTPUTBLKID);}
}

interface GraphJSON{
    [id: string] : {
        params: {name: string, value: string}[],
        name: string,
        submodule?: string[],
        source: {
            [srcSlot: string] : string
        },
        target: {
            [garSlot: string] : string
        }
    }
}

export class LayerGraph{
    inputBlock = new InputBlock();
    outputBlock = new OutputBlock();
    graph: Map<string, Block> = new Map([[INPUTBLKID, this.inputBlock], [OUTPUTBLKID, this.outputBlock]]);

    addBlock(id: string, blockClass: ClassInfo, fileInfo: FileModuleNode | FolderModuleNode){
        this.graph.set(id, new LayerBlock(id, blockClass, fileInfo));
    }

    connectEdge(sourceEdgeEnd: string, targetEdgeEnd: string): {succ: boolean, msg: string}{
        const sourceEnd = new EdgeEndpoint(sourceEdgeEnd);
        const targetEnd = new EdgeEndpoint(targetEdgeEnd);
        let onSucceed = () => {
            this.graph.get(sourceEnd.nodeID)?.addTar(sourceEnd.asKey(), targetEnd.nodeID);
            this.graph.get(targetEnd.nodeID)?.addSrc(targetEnd.asKey(), sourceEnd.nodeID);
            return {succ: true, msg: ""};
        }
        if(sourceEnd.nodeID == INPUTBLKID){
            return onSucceed();
        }
        else if(targetEnd.nodeID == OUTPUTBLKID){
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

    initFromJSON(jsonObj: any){
        const packageId = Database.findPackage("torch", "1.0.0")!;
        const torch = Database.getPackage(packageId);
        let graph: GraphJSON = jsonObj;
        for(let id of Object.keys(graph)){
            if(id == INPUTBLKID || id == OUTPUTBLKID)
                continue;
            let blockInfo = graph[id];
            if(blockInfo.submodule){
                const submoduleID = torch.getSubModule(blockInfo.submodule, false)!;
                const submodule = Database.getNode(submoduleID);
                const classInfo = submodule.getClass(blockInfo.name)!;
                this.addBlock(id, classInfo, submodule);
                console.log("add node ", id);
            }
        }
        console.log("all nodes added");
        console.log(this.graph);
        for(let id of Object.keys(graph)){
            let blockInfo = graph[id];
            let params: {name:string, value:string}[] = blockInfo.params;
            for(let {name, value} of params){
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
            for(let [thisSlot, srcId] of Object.entries(sources)){
                let [srcNodeSlot, _] = Object.entries(graph[srcId].target).find(([tarSlot, tarId]) => tarId == id)!;
                console.log("find edge ", srcNodeSlot, " to ", thisSlot);
                let ret = this.connectEdge(srcNodeSlot, thisSlot);
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
}

export const globalLayerGraph = new LayerGraph();