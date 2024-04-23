import { readFileSync, writeFileSync } from "fs";
import { Database } from "../src/common/objectStorage";
import { EdgeEndpoint, LayerBlock, LayerGraph } from "../src/codeGen/graphBlock";
import { ClassInfo } from "../src/common/pythonObjectTypes";
import { genAll, genModelClass, genTrainingClass } from "../src/codeGen/pyCodeGen";
import { printNode } from "../src/codeGen/printNode";
import { allGraphs } from "../src/codeGen/multiGraphManager";

Database.fromJSON(JSON.parse(readFileSync("response.json", 'utf-8')));

function getClass(name: string, path: string[]){
    const packageId = Database.findPackage("torch", "1.0.0");
    if (packageId){
        const torch = Database.getPackage(packageId);
        const nnId = torch.getSubModule(path, false);
        if (nnId){
            const nn = Database.getNode(nnId);
            const module = nn.getClass(name);
            if(module)
                return {blockClass: module, fileInfo: nn};
        }
    }
    throw "cannot find class " + name + " at " + path.join('.');
}

function addBlock(graph: LayerGraph, id: string, name: string, path: string[]){
    let classInfo = getClass("Conv2d", ["torch","nn"]);
    graph.addBlock(id, classInfo.blockClass, classInfo.fileInfo);
}

function doAssert(value: any){
    if(value)
        return ;
    throw new Error("assertion failed");
}

function test(){
	let testGraphName = "Testing";
	allGraphs.createGraph(testGraphName);

	doAssert(allGraphs.addBlock(testGraphName, "input", "input", [], {x: 1, y: 1}).succ);
    doAssert(allGraphs.addBlock(testGraphName, "output", "output", [], {x:2, y:2}).succ);
    doAssert(allGraphs.addBlock(testGraphName, "node1", "Conv2d", ["torch","nn"]).succ);
    doAssert(allGraphs.addBlock(testGraphName, "node2", "Conv2d", ["torch","nn"]).succ);
    doAssert(allGraphs.addBlock(testGraphName, "node3", "Tanh", ["torch","nn"]).succ);

    doAssert(allGraphs.setArg(testGraphName, "Conv2d-node1-ini-in_channels-", "123").succ);
    doAssert(allGraphs.setArg(testGraphName, "Conv2d-node1-ini-out_channels-", "456").succ);
    doAssert(allGraphs.setArg(testGraphName, "Conv2d-node2-ini-in_channels-", "789").succ);

	doAssert(allGraphs.addEdge(testGraphName, "input-input-fwd-return-", "Conv2d-node1-fwd-input-").succ);
	doAssert(allGraphs.addEdge(testGraphName, "Conv2d-node1-fwd-return-", "Conv2d-node2-fwd-input-").succ);
	doAssert(allGraphs.addEdge(testGraphName, "Conv2d-node2-fwd-return-", "Tanh-node3-fwd-input-").succ);
	doAssert(allGraphs.addEdge(testGraphName, "Tanh-node3-fwd-return-", "output-output-fwd-input-").succ);

    doAssert(allGraphs.addBlock(testGraphName, "node4", "Tanh", ["torch","nn"]).succ);
	doAssert(allGraphs.addEdge(testGraphName, "Conv2d-node1-fwd-return-", "Tanh-node4-fwd-input-").succ);
	doAssert(allGraphs.addEdge(testGraphName, "Tanh-node4-fwd-return-", "output-output-fwd-input-").succ);
    
	doAssert(allGraphs.addBlock(testGraphName, "node5", "Tanh", ["torch","nn"]).succ);
	doAssert(allGraphs.addEdge(testGraphName, "input-input-fwd-return-0", "Tanh-node5-fwd-input-").succ);
	doAssert(allGraphs.addEdge(testGraphName, "Tanh-node5-fwd-return-", "output-output-fwd-input-").succ);

	writeFileSync("replayOutput.json", JSON.stringify(allGraphs.replayGraph(testGraphName), undefined, 4));

}

test();

console.log("all tests passed");