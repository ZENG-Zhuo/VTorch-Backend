"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const objectStorage_1 = require("../src/common/objectStorage");
objectStorage_1.Database.fromJSON(JSON.parse((0, fs_1.readFileSync)("response.json", 'utf-8')));
const packageId = objectStorage_1.Database.findPackage("torch", "1.0.0");
if (packageId) {
    const torch = objectStorage_1.Database.getPackage(packageId);
    const nnId = torch.getSubModule(["torch", "nn"], false);
    if (nnId) {
        const nn = objectStorage_1.Database.getNode(nnId);
        console.log(nn.relativePath);
        const module = nn.getClass("Tanh");
        console.log(module.toString());
    }
}
