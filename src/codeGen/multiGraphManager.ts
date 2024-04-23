import { EdgeEndpoint, FunctionBlock, LayerBlock, LayerGraph, LiteralBlock } from "./graphBlock";
import { printNode } from "./printNode";
import { genAll, genModelClass } from "./pyCodeGen";

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
                "submodule": blk instanceof LayerBlock ? blk.fileInfo.relativePath : 
                                blk instanceof FunctionBlock ? blk.fileInfo.relativePath :
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

class NamedGraphs{
    graphs: Map<string, GraphWithPosition> = new Map();
    constructor(){}

    createGraph(name: string){
        if(!this.graphs.has(name)){
            this.graphs.set(name, new GraphWithPosition());
            console.log("add graph", name);
        }
    }
    replayGraph(name: string){
        // console.log("replay graph", graphName);
        if(!this.graphs.has(name)){
            return {succ: false, msg: "cannot find graph " + name};
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
    setPosition(graphName: string, id: string, position: any){
        // console.log("set position in graph", graphName);
        if(!this.graphs.has(graphName)){
            return {succ: false, msg: "cannot find graph " + graphName};
        }
        this.graphs.get(graphName)!.position.set(id, position);
    }
    setArg(graphName: string, target: string, value: string){
        // console.log("set arg in graph", graphName);
        if(!this.graphs.has(graphName)){
            return {succ: false, msg: "cannot find graph " + graphName};
        }
        return this.graphs.get(graphName)!.fillArg(target, value);
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
}

export const allGraphs = new NamedGraphs();  