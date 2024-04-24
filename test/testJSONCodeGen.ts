import { readFileSync, writeFileSync } from "fs";
import { Database } from "../src/common/objectStorage";
import { LayerGraph } from "../src/codeGen/graphBlock";
import { printNode } from "../src/codeGen/printNode";
import { genAll } from "../src/codeGen/pyCodeGen";

Database.fromJSON(JSON.parse(readFileSync("response.json", 'utf-8')));
const graph = new LayerGraph();
// graph.initFromJSON(JSON.parse(readFileSync("graph.json", "utf-8")));
// writeFileSync("rewritenGraph.json", JSON.stringify(graph.toJSON(), null, 4));

graph.initFromJSON(JSON.parse(readFileSync("rewritenGraph.json", "utf-8")));

// writeFileSync("codeGen.json", JSON.stringify(genPython(graph), null, 4));
writeFileSync("generatedCode.py", printNode(genAll([graph])));