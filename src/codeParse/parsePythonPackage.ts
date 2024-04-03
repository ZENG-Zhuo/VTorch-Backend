import { statSync } from "fs";
import { getBasename } from "../common/pythonFileTypes";
import { Package, PackageId } from "../common/pythonPackageType";
import { Database } from "../common/objectStorage";
import { randomUUID } from "crypto";
import { buildModuleTree, parsePythonFile } from "./parsePythonModule";

export function parsePackage(filePath: string): PackageId {
    let packageName = getBasename(filePath);
    let version = "1.0.0"; // TODO: fix this latter
    let existingPackage = Database.findPackage(packageName, version);
    if (existingPackage) return existingPackage;
    try {
        let isFile = statSync(filePath).isFile();
        let pythonPackage: Package = new Package(
            isFile,
            filePath,
            packageName,
            version
        );
        pythonPackage.status = "parsing";
        if (isFile) {
            parsePythonFile(filePath, []).then((root) => {
                pythonPackage.root = root;
                pythonPackage.status = "ready";
            });
        } else {
            buildModuleTree(filePath, []).then((root) => {
                pythonPackage.root = root;
                pythonPackage.status = "ready";
            });
        }
        const uuid = randomUUID();
        Database.setPackage(uuid, pythonPackage);
        return uuid;
    } catch (error) {
        throw "Invaild file path: " + filePath;
    }
}
