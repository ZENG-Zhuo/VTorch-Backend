import { readFileSync, writeFileSync } from "fs";
import { LayerGraph } from "../src/codeGen/graphBlock";
import { Database } from "../src/common/objectStorage";

Database.fromJSON(JSON.parse(readFileSync("response.json", 'utf-8')));
const graph = new LayerGraph();
// graph.initFromJSON(JSON.parse(readFileSync("graph.json", "utf-8")));
// writeFileSync("rewritenGraph.json", JSON.stringify(graph.toJSON(), null, 4));

graph.initFromJSON(JSON.parse(readFileSync("rewritenGraph.json", "utf-8")));
writeFileSync("rewritenGraph2.json", JSON.stringify(graph.toJSON(), null, 4));