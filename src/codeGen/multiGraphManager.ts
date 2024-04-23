import { EdgeEndpoint, FunctionBlock, LayerBlock, LayerGraph, LiteralBlock } from "./graphBlock";
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
        this.graphs.set(name, new GraphWithPosition());
    }
    replayGraph(name: string){
        return this.graphs.get(name)!.replayGraphConstruction();
    }

    addBlock(graphName: string, id: string, name: string, submodule: string[], position?: any){
        let ret = this.graphs.get(graphName)!.addBlockByName(id, name, submodule);
        if(ret.succ)
            this.graphs.get(graphName)!.position.set(id, position);
        return ret;
    }
    setPosition(graphName: string, id: string, position: any){
        this.graphs.get(graphName)!.position.set(id, position);
    }
    setArg(graphName: string, target: string, value: string){
        return this.graphs.get(graphName)!.fillArg(target, value);
    }
    addEdge(graphName: string, source: string, target: string){
        return this.graphs.get(graphName)!.connectEdge(source, target);
    }
    genModelCode(graphName: string){
        let graph = this.graphs.get(graphName)!;
        let ready = graph.readyForGen();
        if(!ready.succ)
            return ready;
        return {succ: true, code: genAll([graph])};
    }
}

export const allGraphs = new NamedGraphs();  