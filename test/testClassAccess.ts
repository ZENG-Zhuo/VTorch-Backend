import { readFileSync, writeFileSync } from "fs";
import { Database } from "../src/common/objectStorage";

Database.fromJSON(JSON.parse(readFileSync("response.json", 'utf-8')));

const packageId = Database.findPackage("torch", "1.0.0");
if (packageId){
	const torch = Database.getPackage(packageId);
	const nnId = torch.getSubModule(["torch"], false);
	if (nnId){
		const nn = Database.getNode(nnId);
		const module = nn.getFunction("zeros");
		console.log(module?.toString());
		// const func = nn.functions;
		// const funcs = Array.from(nn.importedFunctions.keys()).flatMap(x => nn.getFunction(x))
		// console.log(func, funcs);
		// writeFileSync("allFunctionsNN.txt", (func.join("\n") + "\n\n======imported=====\n\n" + funcs.join("\n")));
	}
}