import { defineDataset } from "../src/codeGen/genDataSetDef";
import { genModel, genModelClass } from "../src/codeGen/genModelDef";
import { LayerGraph } from "../src/codeGen/graphBlock";
import { printNode } from "../src/codeGen/printNode";
import { ImportManager, generateAll } from "../src/codeGen/pyCodeGen";
import { DatasetInfo } from "../src/common/datasetTypes";
import { Database } from "../src/common/objectStorage";
import { readFileSync, writeFileSync } from "fs";

Database.fromJSON(JSON.parse(readFileSync("response.json", 'utf-8')));

function doTest(datasetJson: any, modelGraph: LayerGraph, lossGraph: LayerGraph){
    let imports = new ImportManager();
    const dataset = defineDataset(DatasetInfo.fromJSON(datasetJson), imports);
	const model = genModel(modelGraph, imports);
	const loss = genModel(lossGraph, imports);

	const ret = generateAll(dataset, model, loss, imports);
	writeFileSync("generatedCode.py", printNode(ret));
}

function doAssert(value: {succ: boolean, msg: string}, inverse: boolean = false){
    if(value.succ || !inverse)
        return ;
    throw new Error("assertion failed. Msg: " + value.msg);
}

function genModelGraph(){
    let testingGraph = new LayerGraph("MyModel");
    doAssert(testingGraph.addBlockByName("input", "input", []));
    doAssert(testingGraph.addBlockByName("output", "output", []));
    doAssert(testingGraph.addBlockByName("node1", "Conv2d", ["torch","nn"]));
    doAssert(testingGraph.addBlockByName("node2", "Conv2d", ["torch","nn"]));
    doAssert(testingGraph.addBlockByName("node3", "Tanh", ["torch","nn"]));

    doAssert(testingGraph.updateArg("Conv2d-node1-ini-in_channels-", "123"));
    doAssert(testingGraph.updateArg("Conv2d-node1-ini-out_channels-", "456"));
    doAssert(testingGraph.updateArg("Conv2d-node1-ini-kernel_size-", "1"));
    doAssert(testingGraph.updateArg("Conv2d-node2-ini-in_channels-", "789"));
    doAssert(testingGraph.updateArg("Conv2d-node2-ini-out_channels-", "101"));
    doAssert(testingGraph.updateArg("Conv2d-node1-ini-kernel_size-", "(1,1)"));

	doAssert(testingGraph.connectEdge("input-input-fwd-return-", "Conv2d-node1-fwd-input-"));
	doAssert(testingGraph.connectEdge("Conv2d-node1-fwd-return-", "Conv2d-node2-fwd-input-"));
	doAssert(testingGraph.connectEdge("Conv2d-node2-fwd-return-", "Tanh-node3-fwd-input-"));
	doAssert(testingGraph.connectEdge("Tanh-node3-fwd-return-", "output-output-fwd-input-"));

	doAssert(testingGraph.readyForGen());
	return testingGraph;
}

function genLossGraph(){
    let testingGraph = new LayerGraph("MyLoss");
    doAssert(testingGraph.addBlockByName("input", "input", []));
    doAssert(testingGraph.addBlockByName("output", "output", []));
    doAssert(testingGraph.addBlockByName("target", "groundtruth", []));
    doAssert(testingGraph.addBlockByName("node3", "cross_entropy$1", ["torch","nn", "functional"]));

	doAssert(testingGraph.connectEdge("input-input-fwd-return-", "cross_entropy$1-node3-fwd-input-"));
	doAssert(testingGraph.connectEdge("groundtruth-target-fwd-return-", "cross_entropy$1-node3-fwd-target-"));
	doAssert(testingGraph.connectEdge("cross_entropy$1-node3-fwd-return-", "output-output-fwd-input-"));

	doAssert(testingGraph.readyForGen());
	return testingGraph;
}

function test1(){
    // let datasetJson = {
    //     "name": "12",
    //     "type": "SegmentationDatasetInfo",
    //     "config": {
    //         imgDir: "hello",
    //         maskDir: "world",
    //         transforms: [
    //             { "name": "Resize", "parameters": ["(256, 256)"] },
    //             { "name": "ToTensor", "parameters": [] }
    //         ]
    //     }
    // }
	let datasetJson = JSON.parse(readFileSync("torchvisionDataset.json", 'utf-8'))
    doTest(datasetJson, genModelGraph(), genLossGraph());
}

test1();

