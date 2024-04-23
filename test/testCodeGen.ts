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
    if(value.succ || inverse)
        return ;
    throw new Error("assertion failed. Msg: " + value.msg);
}

function test(){
    let testingGraph = new LayerGraph();
    testingGraph.addBlockByName("input", "input", []);
    testingGraph.addBlockByName("output", "output", []);
    testingGraph.addBlockByName("node1", "Conv2d", ["torch","nn"]);
    testingGraph.addBlockByName("node2", "Conv2d", ["torch","nn"]);
    testingGraph.addBlockByName("node3", "Tanh", ["torch","nn"]);

    doAssert(testingGraph.fillArg("Conv2d-node1-ini-in_channels-", "123"));
    doAssert(testingGraph.fillArg("Conv2d-node1-ini-out_channels-", "456"));
    doAssert(testingGraph.fillArg("Conv2d-node2-ini-in_channels-", "789"));

	doAssert(testingGraph.connectEdge("input-input-fwd-return-", "Conv2d-node1-fwd-input-"));
	doAssert(testingGraph.connectEdge("Conv2d-node1-fwd-return-", "Conv2d-node2-fwd-input-"));
	doAssert(testingGraph.connectEdge("Conv2d-node2-fwd-return-", "Tanh-node3-fwd-input-"));
	doAssert(testingGraph.connectEdge("Tanh-node3-fwd-return-", "output-output-fwd-input-"));

    testingGraph.addBlockByName("node4", "Tanh", ["torch","nn"]);
	doAssert(testingGraph.connectEdge("Conv2d-node1-fwd-return-", "Tanh-node4-fwd-input-"));
	doAssert(testingGraph.connectEdge("Tanh-node4-fwd-return-", "output-output-fwd-input-"));
    
	testingGraph.addBlockByName("node5", "Tanh", ["torch","nn"]);
	doAssert(testingGraph.connectEdge("input-input-fwd-return-0", "Tanh-node5-fwd-input-"));
	doAssert(testingGraph.connectEdge("Tanh-node5-fwd-return-", "output-output-fwd-input-"));

	console.log(printNode(genAll([testingGraph])));

	console.log(printNode(genTrainingClass("MyModel", "MyLoss")));
}

function test2(){
    let testingGraph = new LayerGraph();
    testingGraph.addBlockByName("node1", "input", []);
    testingGraph.addBlockByName("node3", "output", []);
    testingGraph.addBlockByName("node2", "Linear", ["torch","nn"]);
    
	doAssert(testingGraph.connectEdge("input-node1-fwd-return-", "Linear-node2-fwd-input-"));
	doAssert(testingGraph.connectEdge("Linear-node2-fwd-return-", "output-node3-fwd-input-"));
    doAssert(testingGraph.readyForGen(), true);

    
    doAssert(testingGraph.fillArg("Linear-node2-ini-in_features-", "123"));
    doAssert(testingGraph.fillArg("Linear-node2-ini-out_features-", "456"));
	console.log(printNode(genAll([testingGraph])));
}

function test3(){
    let testingGraph = new LayerGraph();
    testingGraph.addBlockByName("node1", "input", []);
    testingGraph.addBlockByName("node3", "output", []);
    testingGraph.addBlockByName("node2", "Softmax", ["torch","nn"]);
    
	doAssert(testingGraph.connectEdge("input-node1-fwd-return-", "Softmax-node2-fwd-input-"));
	doAssert(testingGraph.connectEdge("Softmax-node2-fwd-return-", "output-node3-fwd-input-"));
    doAssert(testingGraph.readyForGen());

	console.log(printNode(genAll([testingGraph])));
}

function test4(){
    let testingGraph = new LayerGraph();
    testingGraph.addBlockByName("node1", "input", []);
    testingGraph.addBlockByName("node3", "output", []);
    testingGraph.addBlockByName("node2", "Softmax", ["torch","nn"]);
    testingGraph.addBlockByName("node4", "sum$1", ["torch"]);
    testingGraph.addBlockByName("node5", "vstack$1", ["torch"]);
    
	doAssert(testingGraph.connectEdge("input-node1-fwd-return-", "Softmax-node2-fwd-input-"));
	doAssert(testingGraph.connectEdge("Softmax-node2-fwd-return-", "sum$1-node4-fwd-input-"));
	doAssert(testingGraph.connectEdge("sum$1-node4-fwd-return-", "vstack$1-node5-fwd-tensors-"));
	doAssert(testingGraph.connectEdge("Softmax-node2-fwd-return-", "vstack$1-node5-fwd-tensors-"));
    
	doAssert(testingGraph.connectEdge("vstack$1-node5-fwd-return-", "output-node3-fwd-input-"));

    doAssert(testingGraph.readyForGen());
    
    // doAssert(testingGraph.fillArg("Linear-node2-ini-in_features-", "123"));
    // doAssert(testingGraph.fillArg("Linear-node2-ini-out_features-", "456"));
	console.log(printNode(genAll([testingGraph])));
}

test4();

console.log("all tests passed");