import { defineDataset } from "../src/codeGen/genDataSetDef";
import { genModel, genModelClass } from "../src/codeGen/genModelDef";
import { LayerGraph } from "../src/codeGen/graphBlock";
import { printNode } from "../src/codeGen/printNode";
import { ImportManager, generateAll } from "../src/codeGen/pyCodeGen";
import { DatasetInfo } from "../src/common/datasetTypes";
import { Database } from "../src/common/objectStorage";
import { readFileSync, writeFileSync } from "fs";
import { OptimizerConfig } from "../src/common/optimizerTypes";

Database.fromJSON(JSON.parse(readFileSync("response.json", 'utf-8')));

function doTest(datasetJson: any, modelGraph: LayerGraph, lossGraph: LayerGraph, optim: OptimizerConfig, dataloaderConfig: string[]){
    const dataset = DatasetInfo.fromJSON(datasetJson);
	const ret = generateAll(dataset, modelGraph, lossGraph, optim, dataloaderConfig);
	writeFileSync("generatedCode.py", printNode(ret));
}

function doAssert(value: {succ: boolean, msg: string}, inverse: boolean = false){
	console.log("asserting", value);
    if(value.succ || inverse)
        return ;
    throw new Error("assertion failed. Msg: " + value.msg);
}

function genModelGraph(){
    let testingGraph = new LayerGraph("MyModel");
    doAssert(testingGraph.addBlockByName("input", "input", []));
    doAssert(testingGraph.addBlockByName("output", "output", []));
    doAssert(testingGraph.addBlockByName("node1", "Linear", ["torch","nn"]));
    doAssert(testingGraph.addBlockByName("node2", "Linear", ["torch","nn"]));
    doAssert(testingGraph.addBlockByName("node3", "Linear", ["torch","nn"]));
    doAssert(testingGraph.addBlockByName("node4", "relu$1", ["torch","nn", "functional"]));
    doAssert(testingGraph.addBlockByName("node5", "relu$1", ["torch","nn", "functional"]));
    doAssert(testingGraph.addBlockByName("node6", "Flatten", ["torch","nn"]));

    doAssert(testingGraph.updateArg("Linear-node1-ini-in_features-", "784"));
    doAssert(testingGraph.updateArg("Linear-node1-ini-out_features-", "512"));
    doAssert(testingGraph.updateArg("Linear-node2-ini-in_features-", "512"));
    doAssert(testingGraph.updateArg("Linear-node2-ini-out_features-", "256"));
    doAssert(testingGraph.updateArg("Linear-node3-ini-in_features-", "256"));
    doAssert(testingGraph.updateArg("Linear-node3-ini-out_features-", "10"));
    doAssert(testingGraph.updateArg("Flatten-node6-ini-start_dim-", "1"));
    doAssert(testingGraph.updateArg("Flatten-node6-ini-end_dim-", "3"));

	doAssert(testingGraph.connectEdge("input-input-fwd-return-", "Flatten-node6-fwd-input-"));
	doAssert(testingGraph.connectEdge("Flatten-node6-fwd-return-", "Linear-node1-fwd-input-"));
	doAssert(testingGraph.connectEdge("Linear-node1-fwd-return-", "relu$1-node4-fwd-input-"));
	doAssert(testingGraph.connectEdge("relu$1-node4-fwd-return-", "Linear-node2-fwd-input-"));
	doAssert(testingGraph.connectEdge("Linear-node2-fwd-return-", "relu$1-node5-fwd-input-"));
	doAssert(testingGraph.connectEdge("relu$1-node5-fwd-return-", "Linear-node3-fwd-input-"));
	doAssert(testingGraph.connectEdge("Linear-node3-fwd-return-", "output-output-fwd-input-"));

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
    let datasetJson = {
        "name": "12",
        "type": "CustomCodeDatasetInfo",
        "config": {
            "code": `
from torchvision.datasets import MNIST
from torchvision.transforms import Compose, ToTensor, Normalize
class ABC:
    def __init__(self):
        pass
`, 
            "datasetDefinition": "MNIST(root=\"../data\",train=True,transform=Compose([ToTensor(), Normalize((0.1307,),(0.3081,))]),download=True)"
        }
    }
	// let datasetJson = {
    //     "name": "11",
    //     "type": "TorchvisionDatasetInfo",
    //     "torchvisionDatasetName": "MNIST",
    //     "initFuncParams": [
    //         "\"./data\"",
    //         "True",
    //         [
    //             { "name": "ToTensor", "parameters": [] },
    //             { "name": "Normalize", "parameters": ["(0.1307,)", "(0.3081,)"] }
    //         ],
    //         [],
    //         "True"
    //     ]
    // };
	let optim: OptimizerConfig = {
		name: "Adam",
		parameters: ["1e-4"]
	};
	let dataloaderConfig = ["64", "", "", "", "", "", ""];
    doTest(datasetJson, genModelGraph(), genLossGraph(), optim, dataloaderConfig);
}

test1();
