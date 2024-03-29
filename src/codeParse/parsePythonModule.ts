import {
    getBasename,
    FileModuleNode,
    FolderModuleNode,
    NodeId,
} from "../common/pythonFileTypes";
import { extractClassesAndFunctions } from "./parsePythonObject";
import { lstatSync, readFile } from "fs";
import * as path from "path";
import { globSync } from "glob";
import { Database } from "../common/objectStorage";
import { randomUUID } from "crypto";

export async function parsePythonFile(filePath: string): Promise<NodeId> {
    let path = filePath;
    if (!filePath.endsWith(".py")) {
        throw new Error(`FileModule ${path} does not end with .py`);
    }
    let name = getBasename(filePath);
    let uuid = randomUUID();
    const pythonCode = readFile(
        filePath,
        "utf8",
        async function (err, pythonCode) {
            if (err) {
                console.error(err.message);
            } else {
                let classesFunctions = extractClassesAndFunctions(pythonCode);
                Database.setNode(
                    uuid,
                    new FileModuleNode(
                        path,
                        name,
                        classesFunctions[0],
                        classesFunctions[1]
                    )
                );
            }
        }
    );
    console.log(`Async parsing: ${filePath}`);
    return uuid;
}

export async function buildModuleTree(moduleFolder: string): Promise<NodeId> {
    if (lstatSync(moduleFolder).isDirectory()) {
        const root = new FolderModuleNode(moduleFolder);

        // Get all files and folders in the given module folder
        const fileNames = globSync(path.join(moduleFolder, "*"));

        for (const fileName of fileNames) {
            if (
                lstatSync(fileName).isDirectory() &&
                !path.basename(fileName).startsWith("_")
            ) {
                // If it's a subdirectory, recursively call the function
                const child = await buildModuleTree(fileName);
                root.children.push(child);
            } else if (
                lstatSync(fileName).isFile() &&
                fileName.endsWith(".py") &&
                (path.basename(fileName).includes("__init__") ||
                    !path.basename(fileName).startsWith("_"))
            ) {
                // If it's a Python module, add it as a child node
                const child = await parsePythonFile(fileName);
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
