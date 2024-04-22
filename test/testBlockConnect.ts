import { readFileSync, writeFileSync } from "fs";
import { Database } from "../src/common/objectStorage";
import { EdgeEndpoint, LayerBlock, LayerGraph } from "../src/codeGen/graphBlock";
import { ClassInfo } from "../src/common/pythonObjectTypes";

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
    doAssert(testingGraph.fillArg("Conv2d-node1-ini-in_channels-", "123").succ);
    doAssert(!testingGraph.fillArg("Conv2d-node1-ini-in_channels-", "123").succ);
    doAssert(
        (testingGraph.get("node1")! as LayerBlock).gratherArgs("ini")
            .find(([paramName, _]) => paramName == "in_channels")?.[1] 
        instanceof EdgeEndpoint
    );

    doAssert(testingGraph.fillArg("Conv2d-node1-ini-padding-", "123").succ);
    doAssert(
        (testingGraph.get("node1")! as LayerBlock).gratherArgs("ini")
            .find(([paramName, _]) => paramName == "padding")?.[1] 
        instanceof EdgeEndpoint
    );
    doAssert(testingGraph.fillArg("Conv2d-node1-ini-padding-", "123").succ);
    doAssert(
        (testingGraph.get("node1")! as LayerBlock).gratherArgs("ini")
            .find(([paramName, _]) => paramName == "padding")?.[1] 
        instanceof Array
    );
    doAssert(!testingGraph.fillArg("Conv2d-node1-ini-padding-", "123").succ);
}

test();

console.log("all tests passed");