import { CodeGenInfo } from "../common/codeGenTypes";
import { datasets } from "../routes/datasetsRouter";
import { EdgeEndpoint, FunctionBlock, LayerBlock, LayerGraph, LiteralBlock } from "./graphBlock";
import { printNode } from "./printNode";
import { genAll, generateAll } from "./pyCodeGen";

interface Operation{
    op: string,
    body: any
}
class GraphWithPosition extends LayerGraph{
    position: Map<string, any> = new Map();

    replayGraphConstruction(): Operation[]{
        let ret: Operation[] = [];
        for(let [id, blk] of this.graph.entries()){
            if(blk instanceof LiteralBlock)
                continue;
            let body = {
                id, 
                "name": blk.blockType, 
                "submodule": blk instanceof LayerBlock ? blk.getPath() : 
                                blk instanceof FunctionBlock ? blk.getPath() :
                                [],
                "position": this.position.get(id)
            };
            ret.push({op: "addBlock", body});
        }
        for(let blk of this.graph.values()){
            if(blk instanceof LiteralBlock)
                continue;
            let tmp = Array.from(blk.fSrc.entries()).flatMap( 
                ([key, edges]) => edges.map(
                    e => ({source: e , target: EdgeEndpoint.fromKeyString(blk, key)})
                )
            );
            for(let e of tmp){
                if(e.source.nodeType == LiteralBlock.literalNodeType)
                    ret.push({op: "changeArgument", body: {
                        "target": e.target.toString(),
                        "value": (this.graph.get(e.source.nodeID)! as LiteralBlock).getText()
                    }});
                else 
                    ret.push({op: "addEdge", body: {
                        "source": e.source.toString(),
                        "target": e.target.toString()
                    }});
            }
        }
        return ret;
    }
}


function toValidName(varName: string): string {
    const regex = /[^a-zA-Z0-9]+/g;
    return varName.replace(regex, '_');
}

class NamedGraphs{
    graphs: Map<string, GraphWithPosition> = new Map();
    constructor(){}

    createGraph(name: string){
        if(!this.graphs.has(name)){
            this.graphs.set(name, new GraphWithPosition("Module_" + toValidName(name)));
            console.log("add graph", name);
        }
    }
    replayGraph(name: string){
        // console.log("replay graph", graphName);
        if(!this.graphs.has(name)){
            this.graphs.set(name, new GraphWithPosition("Module_" + toValidName(name)));
            console.log("create new graph " + "Module_" + toValidName(name));
            return [];
        }
        return this.graphs.get(name)!.replayGraphConstruction();
    }

    addBlock(graphName: string, id: string, name: string, submodule: string[], position?: any){
        console.log("Current graphs: ", this.graphs);
        if(!this.graphs.has(graphName)){
            return {succ: false, msg: "cannot find graph " + graphName};
        }
        let ret = this.graphs.get(graphName)!.addBlockByName(id, name, submodule);
        if(ret.succ)
            this.graphs.get(graphName)!.position.set(id, position);
        return ret;
    }
    deleteBlock(graphName: string, id: string){
        if(!this.graphs.has(graphName)){
            return {succ: false, msg: "cannot find graph " + graphName};
        }
        let ret = this.graphs.get(graphName)!.removeNode(id);
        if(ret.succ)
            this.graphs.get(graphName)!.position.delete(id);
        return ret;
    }
    setPosition(graphName: string, id: string, position: any){
        // console.log("set position in graph", graphName);
        if(!this.graphs.has(graphName)){
            return {succ: false, msg: "cannot find graph " + graphName};
        }
        if(!this.graphs.get(graphName)?.position.has(id)){
            return {succ: false, msg: "cannot find node " + id};
        }
        this.graphs.get(graphName)!.position.set(id, position);
        return {succ: true, msg: ""};
    }
    setArg(graphName: string, target: string, value: string){
        // console.log("set arg in graph", graphName);
        if(!this.graphs.has(graphName)){
            return {succ: false, msg: "cannot find graph " + graphName};
        }
        return this.graphs.get(graphName)!.updateArg(target, value);
    }
    addEdge(graphName: string, source: string, target: string){
        // console.log("add edge to graph", graphName);
        if(!this.graphs.has(graphName)){
            return {succ: false, msg: "cannot find graph " + graphName};
        }
        let ret = this.graphs.get(graphName)!.connectEdge(source, target);
        console.log(ret.msg);
        return ret;
    }
    removeEdge(graphName: string, source: string, target: string){
        if(!this.graphs.has(graphName)){
            return {succ: false, msg: "cannot find graph " + graphName};
        }
        let ret = this.graphs.get(graphName)!.removeEdge(source, target);
        console.log(ret.msg);
        return ret;
    }
    genModelCode(graphName: string){
        // console.log("gen code from graph", graphName);
        if(!this.graphs.has(graphName)){
            return {succ: false, msg: "cannot find graph " + graphName};
        }
        let graph = this.graphs.get(graphName)!;
        let ready = graph.readyForGen();
        if(!ready.succ)
            return ready;
        return {succ: true, code: printNode(genAll([graph]))};
    }
    genAllCode(codeGenInfo: CodeGenInfo): {succ: boolean, msg: string} {
        if(!this.graphs.has(codeGenInfo.modelName) || !allGraphs.graphs.get(codeGenInfo.modelName)?.readyForGen()){
            return {succ: false, msg: "Model " + codeGenInfo.modelName + " not ready"};
        }
        if(!this.graphs.has(codeGenInfo.lossName) || !allGraphs.graphs.get(codeGenInfo.lossName)?.readyForGen()){
            return {succ: false, msg: "Loss function " + codeGenInfo.modelName + " not ready"};
        }
        let modelGraph = this.graphs.get(codeGenInfo.modelName)!;
        let lossGraph = this.graphs.get(codeGenInfo.lossName)!;
        if(modelGraph.inputBlocks.length > 1)
            return {succ: false, msg: "Model " + codeGenInfo.modelName + " has multiple inputs"};
        if(modelGraph.outputBlocks.length != 1)
            return {succ: false, msg: "Model " + codeGenInfo.modelName + " must have single output"};
        if(modelGraph.groundTruthBlocks.length > 0)
            return {succ: false, msg: "Model " + codeGenInfo.modelName + " must not have groundtruth input"};
        if(lossGraph.inputBlocks.length > 1)
            return {succ: false, msg: "Loss function " + codeGenInfo.lossName + " has multiple inputs"};
        if(lossGraph.groundTruthBlocks.length > 1)
            return {succ: false, msg: "Loss function " + codeGenInfo.lossName + " has multiple groundtruth inputs"};
        if(lossGraph.outputBlocks.length != 1)
            return {succ: false, msg: "Loss function " + codeGenInfo.lossName + " must have single output"};
        if(!datasets.has(codeGenInfo.datasetName))
            return {succ: false, msg: "Dataset " + codeGenInfo.lossName + " not found"};
        let codes = generateAll(
            datasets.get(codeGenInfo.datasetName)!, modelGraph, lossGraph, codeGenInfo.optimizerConfig, codeGenInfo.dataloaderParams
        );
        return {succ: true, msg: printNode(codes)};
    }

    getReadyGraphs(): string[]{
        return Array.from(this.graphs.entries()).filter(([name, graph]) => graph.readyForGen()).map(([name, graph]) => name);
    }
}

export const allGraphs = new NamedGraphs();  