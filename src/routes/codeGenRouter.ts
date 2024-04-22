import { Router } from "express";
import { readFileSync, writeFileSync } from "fs";
import { globalLayerGraph } from "../codeGen/graphBlock";
import { genModelClass } from "../codeGen/pyCodeGen";

export const codeGenRouter = Router();

// body: {"source": "avgpool-node1-fwd-return-1", "target": "avgpool-node1-fwd-input"}
// return: true if edge accepted, false if edge rejected (type not match)
codeGenRouter.post("/addEdge", (req, res) => {
    console.log(req.body);
    let source: string = req.body.source;
	let target: string = req.body.target;
	const result = globalLayerGraph.connectEdge(source, target);
	if(result.succ){
		res.send("true");
	}
	else res.status(400).send(result.msg);
});

codeGenRouter.post("/delEdge", (req, res) => {
    console.log(req.body);
    let source: string = req.body.source;
	let target: string = req.body.target;
	
	// not implemented yet
	const result = {
		"succ": true,	//may be false. require edges to be deleted in an order
		"msg": ""
	};

	if(result.succ){
		res.send("true");
	}
	else res.status(400).send(result.msg);	
});

// body: {"id": "node1", "name": "Conv2d", "submodule": ["torch", "nn"]}
codeGenRouter.post("/addBlock", (req, res) => {
	console.log(req.body);
    let id: string = req.body.id;
	let name: string = req.body.name;
	let submodule: string[] = req.body.submodule;

	const result = globalLayerGraph.addBlockByName(id, name, submodule);
	if(result.succ){
		res.send("true");
	}
	else res.status(400).send(result.msg);
});

// body: {"id": "node1"}
codeGenRouter.post("/delBlock", (req, res) => {
    console.log(req.body);
    let source: string = req.body.source;
	let target: string = req.body.target;
	
	// not implemented yet
	const result = {
		"succ": true,	//may be false
		"msg": ""
	};

	if(result.succ){
		res.send("true");
	}
	else res.status(400).send(result.msg);	
});

// body: {"target": "avgpool-node1-ini-in_channels", "value": "1"}
// return: true if arg setting accepted, false if arg setting rejected (type not match)
codeGenRouter.post("/addArgument", (req, res) => {
    console.log(req.body);
	let target: string = req.body.target;
	let value: string = req.body.value;
	const result = globalLayerGraph.fillArg(target, value);
	if(result.succ){
		res.send("true");
	}
	else res.status(400).send(result.msg);
});

codeGenRouter.post("/changeArgument", (req, res) => {
    console.log(req.body);
	let target: string = req.body.target;
	let value: string = req.body.value;

	// not implemented yet
	const result = {
		"succ": true,	
		"msg": ""
	};
	
	if(result.succ){
		res.send("true");
	}
	else res.status(400).send(result.msg);	
});

codeGenRouter.get("/genPythonCode", (req, res) => {

	let pythonCode = genModelClass(globalLayerGraph, "MyModel");
	const result = {
		"succ": true,	//will check graph completeness in the future
		"code": pythonCode,
		"msg": ""
	};
	
	if(result.succ){
		res.send(result.code);
	}
	else res.status(400).send(result.msg);	
})

