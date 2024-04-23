import { readFileSync, writeFileSync } from "fs";
import { Database } from "../src/common/objectStorage";
import { EdgeEndpoint, LayerBlock, LayerGraph } from "../src/codeGen/graphBlock";
import { ClassInfo } from "../src/common/pythonObjectTypes";
import { genAll, genModelClass, genTrainingClass } from "../src/codeGen/pyCodeGen";
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

function doAssert(value: {succ: boolean, msg: string}, inverse: boolean = false){
    if(value.succ !== inverse)
        return ;
    throw new Error("assertion failed. Msg: " + value.msg);
}

function test4(){
    let testingGraph = new LayerGraph();
    // doAssert(testingGraph.addBlockByName("node1", "input", []));
    // doAssert(testingGraph.addBlockByName("node3", "output", []));
    doAssert(testingGraph.addBlockByName("node4", "sum$1", ["torch"]));

	doAssert(testingGraph.updateArg("sum$1-node4-fwd-dtype-", "float32"));
	doAssert(testingGraph.updateArg("sum$1-node4-fwd-dtype-", "float64"));
	doAssert(testingGraph.updateArg("sum$1-node4-fwd-dtype-", "64"), true);
    
    doAssert(testingGraph.addBlockByName("node1", "input", []));
    doAssert(testingGraph.addBlockByName("node2", "Softmax", ["torch","nn"]));

	doAssert(testingGraph.connectEdge("input-node1-fwd-return-", "Softmax-node2-fwd-input-"));
	doAssert(testingGraph.removeEdge("input-node1-fwd-return-", "Softmax-node2-fwd-input-"));

	
    doAssert(testingGraph.addBlockByName("node5", "vstack$1", ["torch"]));
	doAssert(testingGraph.connectEdge("sum$1-node4-fwd-return-", "vstack$1-node5-fwd-tensors-"));
	doAssert(testingGraph.connectEdge("Softmax-node2-fwd-return-", "vstack$1-node5-fwd-tensors-"));
	doAssert(testingGraph.removeEdge("sum$1-node4-fwd-return-", "vstack$1-node5-fwd-tensors-"), true);
	doAssert(testingGraph.removeEdge("Softmax-node2-fwd-return-", "vstack$1-node5-fwd-tensors-"));

	doAssert(testingGraph.removeNode("node2"));
	doAssert(testingGraph.removeNode("node4"), true);
	doAssert(testingGraph.removeNode("node5"));
	doAssert(testingGraph.removeNode("node4"));

	console.log(testingGraph.graph);
}

test4();

console.log("All tests passed");