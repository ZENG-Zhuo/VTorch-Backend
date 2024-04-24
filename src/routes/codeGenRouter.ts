import { Router } from "express";
import { readFileSync, writeFileSync } from "fs";
import { allGraphs } from "../codeGen/multiGraphManager";
import { CodeGenInfo } from "../common/codeGenTypes";

export const codeGenRouter = Router();

// body: {"graphName": "MyModel",  "source": "avgpool-node1-fwd-return-1", "target": "avgpool-node1-fwd-input"}
// return: true if edge accepted, false if edge rejected (type not match)
codeGenRouter.post("/addEdge", (req, res) => {
    console.log(req.body);
    let graphName: string = req.body.graphName;
    let source: string = req.body.source;
    let target: string = req.body.target;
    const result = allGraphs.addEdge(graphName, source, target);
    if (result.succ) {
        res.send("true");
    } else res.status(400).send(result.msg);
});

codeGenRouter.post("/delEdge", (req, res) => {
    console.log(req.body);
    let graphName: string = req.body.graphName;
    let source: string = req.body.source;
	let target: string = req.body.target;
	
	const result = allGraphs.removeEdge(graphName, source, target);
	if(result.succ){
		res.send("true");
	}
	else res.status(400).send(result.msg);	
});

// body: {"graphName": "MyModel", "id": "node1", "name": "Conv2d", "submodule": ["torch", "nn"], "position": ?}
codeGenRouter.post("/addBlock", (req, res) => {
    console.log(req.body);
    let graphName: string = req.body.graphName;
    let id: string = req.body.id;
    let name: string = req.body.name;
    let submodule: string[] = req.body.submodule;
    let position = req.body.position;

    const result = allGraphs.addBlock(graphName, id, name, submodule, position);
    if (result.succ) {
        res.send("true");
    } else res.status(400).send(result.msg);
});

// body: {"graphName": "MyModel", "id": "node1"}
codeGenRouter.post("/delBlock", (req, res) => {
    console.log(req.body);
	let graphName: string = req.body.graphName;
    let id: string = req.body.id;
	
	const result = allGraphs.deleteBlock(graphName, id);

    if (result.succ) {
        res.send("true");
    } else res.status(400).send(result.msg);
});

// body: {"graphName": "MyModel", "target": "avgpool-node1-ini-in_channels", "value": "1"}
// return: true if arg setting accepted, false if arg setting rejected (type not match)
codeGenRouter.post("/addArgument", (req, res) => {
    console.log(req.body);
    let graphName: string = req.body.graphName;
    let target: string = req.body.target;
    let value: string = req.body.value;
    const result = allGraphs.setArg(graphName, target, value);
    if (result.succ) {
        res.send("true");
    } else res.status(400).send(result.msg);
});

codeGenRouter.post("/changeArgument", (req, res) => {
    console.log(req.body);
    let graphName: string = req.body.graphName;
    let target: string = req.body.target;
    let value: string = req.body.value;

    // not implemented yet
    const result = allGraphs.setArg(graphName, target, value);
    if (result.succ) {
        res.send("true");
    } else res.status(400).send(result.msg);
});

codeGenRouter.post("/replayGraph", (req, res) => {
    console.log(req.body);
    let graphName: string = req.body.graphName;
    let replayed = allGraphs.replayGraph(graphName);
    res.send(JSON.stringify(replayed));
});

// {"graphName": "MyModel", "id": "node1", "position": {"x": "1", "y", "1"}}
codeGenRouter.post("/changePosition", (req, res) => {
    let graphName: string = req.body.graphName;
    let nodeId: string = req.body.id;
    let position: string = req.body.position;
    let ret = allGraphs.setPosition(graphName, nodeId, position);
    if(ret.succ){
        res.send("true");
    }
    else res.status(400).send(ret.msg);
});

codeGenRouter.post("/generateCode", async (req, res) => {
    const codeGenInfo: CodeGenInfo = {
        datasetName: req.body.datasetName,
        modelName: req.body.modelName,
        lossName: req.body.lossName,
        optimizerConfig: req.body.optimizerConfig,
        dataloaderParams: req.body.dataloaderParams,
    };

    console.log("Code generation info: ", codeGenInfo);

    const ret = allGraphs.genAllCode(codeGenInfo);
    if(ret.succ)
        res.send(ret.msg);
    else res.status(400).send(ret.msg);
});

codeGenRouter.post("/getReadyGraphs", async (req, res) => {
    res.send(JSON.stringify(allGraphs.getReadyGraphs()));
});
