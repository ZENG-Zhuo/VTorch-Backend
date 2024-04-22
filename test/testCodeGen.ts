import { readFileSync, writeFileSync } from "fs";
import { Database } from "../src/common/objectStorage";
import { EdgeEndpoint, LayerBlock, LayerGraph } from "../src/codeGen/graphBlock";
import { ClassInfo } from "../src/common/pythonObjectTypes";
import { genModelClass, genTrainingClass } from "../src/codeGen/pyCodeGen";
import { printNode } from "../src/codeGen/printNode";

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
    let testingGraph = new LayerGraph();
    testingGraph.addBlockByName("node1", "Conv2d", ["torch","nn"]);
    testingGraph.addBlockByName("node2", "Conv2d", ["torch","nn"]);
    testingGraph.addBlockByName("node3", "Tanh", ["torch","nn"]);

    doAssert(testingGraph.fillArg("Conv2d-node1-ini-in_channels-", "123").succ);
    doAssert(testingGraph.fillArg("Conv2d-node1-ini-out_channels-", "456").succ);
    doAssert(testingGraph.fillArg("Conv2d-node2-ini-in_channels-", "789").succ);

	doAssert(testingGraph.connectEdge("input-input-fwd-return-", "Conv2d-node1-fwd-input-").succ);
	doAssert(testingGraph.connectEdge("Conv2d-node1-fwd-return-", "Conv2d-node2-fwd-input-").succ);
	doAssert(testingGraph.connectEdge("Conv2d-node2-fwd-return-", "Tanh-node3-fwd-input-").succ);
	doAssert(testingGraph.connectEdge("Tanh-node3-fwd-return-", "output-output-fwd-input-").succ);

    testingGraph.addBlockByName("node4", "Tanh", ["torch","nn"]);
	doAssert(testingGraph.connectEdge("Conv2d-node1-fwd-return-", "Tanh-node4-fwd-input-").succ);
	doAssert(testingGraph.connectEdge("Tanh-node4-fwd-return-", "output-output-fwd-input-").succ);
    
	testingGraph.addBlockByName("node5", "Tanh", ["torch","nn"]);
	doAssert(testingGraph.connectEdge("input-input-fwd-return-0", "Tanh-node5-fwd-input-").succ);
	doAssert(testingGraph.connectEdge("Tanh-node5-fwd-return-", "output-output-fwd-input-").succ);

	console.log(printNode(genModelClass(testingGraph, "MyModel")));

	console.log(printNode(genTrainingClass("MyModel", "MyLoss")));
}

test();

console.log("all tests passed");