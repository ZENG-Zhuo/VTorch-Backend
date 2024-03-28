import {
    getBasename,
    FileModuleNode,
    FolderModuleNode,
    NodeId,
} from "../common/pythonFileTypes";
import { extractClassesAndFunctions } from "./parsePythonObject";
import { readFileSync, lstatSync } from "fs";
import * as path from "path";
import { globSync } from "glob";
import { Database } from "../common/objectStorage";
import { randomUUID } from "crypto";

export function parsePythonFile(filePath: string): NodeId {
    let path = filePath;
    if (!filePath.endsWith(".py")) {
        throw new Error(`FileModule ${path} does not end with .py`);
    }
    let name = getBasename(filePath);
    const pythonCode = readFileSync(filePath, "utf8");
    console.log(`Parsing: ${filePath}`);
    let classesFunctions = extractClassesAndFunctions(pythonCode);
    let uuid = randomUUID();
    Database.setNode(
        uuid,
        new FileModuleNode(path, name, classesFunctions[0], classesFunctions[1])
    );
    return uuid;
}

export function buildModuleTree(moduleFolder: string): NodeId {
    if (lstatSync(moduleFolder).isDirectory()) {
        const root = new FolderModuleNode(moduleFolder);

        // Get all files and folders in the given module folder
        const fileNames = globSync(path.join(moduleFolder, "*"));

        for (const fileName of fileNames) {
            if (lstatSync(fileName).isDirectory()) {
                // If it's a subdirectory, recursively call the function
                const child = buildModuleTree(fileName);
                root.children.push(child);
            } else if (fileName.endsWith(".py")) {
                // If it's a Python module, add it as a child node
                const child = parsePythonFile(fileName);
                root.children.push(child);
            }
        }
        let uuid = randomUUID();
        Database.setNode(uuid, root);
        return uuid;
    } else {
        // moduleFolder should be a directory, so this line should never be called
        return parsePythonFile(moduleFolder);
    }
}
