import { readFileSync } from "fs";
import { Database } from "../src/common/objectStorage";

Database.fromJSON(JSON.parse(readFileSync("response.json", 'utf-8')));

const packageId = Database.findPackage("torch", "1.0.0");
if (packageId){
	const torch = Database.getPackage(packageId);
	const nnId = torch.getSubModule(["torch", "nn"], false);
	if (nnId){
		const conv2d = Database.getNode(nnId).getClass("AvgPool2d")!;
		console.log(conv2d.toString());
	}
}