import { Router } from "express";
import { readFileSync, writeFileSync } from "fs";
import { allGraphs } from "../codeGen/multiGraphManager";

export const codeGenRouter = Router();

// body: {"graphName": "MyModel",  "source": "avgpool-node1-fwd-return-1", "target": "avgpool-node1-fwd-input"}
// return: true if edge accepted, false if edge rejected (type not match)
codeGenRouter.post("/addEdge", (req, res) => {
    console.log(req.body);
	let graphName: string = req.body.graphName;
    let source: string = req.body.source;
	let target: string = req.body.target;
	const result = allGraphs.addEdge(graphName, source, target);
	if(result.succ){
		res.send("true");
	}
	else res.status(400).send(result.msg);
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

// body: {"graphName": "MyModel", "id": "node1", "name": "Conv2d", "submodule": ["torch", "nn"]}
codeGenRouter.post("/addBlock", (req, res) => {
	console.log(req.body);
	let graphName: string = req.body.graphName;
    let id: string = req.body.id;
	let name: string = req.body.name;
	let submodule: string[] = req.body.submodule;

	const result = allGraphs.addBlock(graphName, id, name, submodule);
	if(result.succ){
		res.send("true");
	}
	else res.status(400).send(result.msg);
});

// body: {"graphName": "MyModel", "id": "node1"}
codeGenRouter.post("/delBlock", (req, res) => {
    console.log(req.body);
	let graphName: string = req.body.graphName;
    let id: string = req.body.id;
	
	const result = allGraphs.deleteBlock(graphName, id);

	if(result.succ){
		res.send("true");
	}
	else res.status(400).send(result.msg);	
});

// body: {"graphName": "MyModel", "target": "avgpool-node1-ini-in_channels", "value": "1"}
// return: true if arg setting accepted, false if arg setting rejected (type not match)
codeGenRouter.post("/changeArgument", (req, res) => {
    console.log(req.body);
	let graphName: string = req.body.graphName;
	let target: string = req.body.target;
	let value: string = req.body.value;

	// not implemented yet
	const result = allGraphs.setArg(graphName, target, value);
	if(result.succ){
		res.send("true");
	}
	else res.status(400).send(result.msg);
});

// body: {"graphName": "MyModel"}
codeGenRouter.post("/genPythonCode", (req, res) => {
	let graphName: string = req.body.graphName;
	let pythonCode = allGraphs.genModelCode(graphName);
	const result = {
		"succ": true,	//will check graph completeness in the future
		"code": pythonCode,
		"msg": ""
	};
	
	if(result.succ){
		res.send(result.code);
	}
	else res.status(400).send(result.msg);	
});

codeGenRouter.post("/replayGraph", (req, res) => {
	let graphName: string = req.body.graphName;
	let replayed = allGraphs.replayGraph(graphName);
	res.send(JSON.stringify(replayed));
})
codeGenRouter.post("/createGraph", (req, res) => {
	let graphName: string = req.body.graphName;
	allGraphs.createGraph(graphName);
	res.send();
})

