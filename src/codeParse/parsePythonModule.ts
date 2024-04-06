import {
    getBasename,
    FileModuleNode,
    FolderModuleNode,
    NodeId,
} from "../common/pythonFileTypes";
import {
    extractAllObjects,
    extractClassesAndFunctions,
} from "./parsePythonObject";
import { lstatSync, readFile } from "fs";
import * as path from "path";
import { globSync } from "glob";
import { Database } from "../common/objectStorage";
import { randomUUID } from "crypto";
let finishedJobs: number = 0;
let totalJobs: number = 0;
export async function parsePythonFile(
    filePath: string,
    baseRelativePath: string[]
): Promise<NodeId> {
    totalJobs += 1;
    console.log("new job parsing:", filePath);
    if (!filePath.endsWith(".py")) {
        throw new Error(`FileModule ${filePath} does not end with .py`);
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
                let classesFunctionsImports =
                    extractClassesAndFunctions(pythonCode);
                const __all__ = extractAllObjects(pythonCode);
                Database.setNode(
                    uuid,
                    new FileModuleNode(
                        uuid,
                        filePath,
                        baseRelativePath.concat([
                            path.basename(filePath, ".py"),
                        ]),
                        name,
                        classesFunctionsImports[0],
                        classesFunctionsImports[1],
                        classesFunctionsImports[2],
                        __all__
                    )
                );
                finishedJobs += 1;
                console.log(
                    "finished job",
                    filePath,
                    "current status: ",
                    finishedJobs,
                    "/",
                    totalJobs
                );
            }
        }
    );
    console.log(`Async parsing: ${filePath}`);
    return uuid;
}

export async function buildModuleTree(
    moduleFolder: string,
    baseRelativePath: string[]
): Promise<NodeId> {
    const relativePath = baseRelativePath.concat([path.basename(moduleFolder)]);
    if (lstatSync(moduleFolder).isDirectory()) {
        const uuid = randomUUID();

        const root = new FolderModuleNode(uuid, moduleFolder, relativePath);

        // Get all files and folders in the given module folder
        const fileNames = globSync(path.join(moduleFolder, "*"));

        for (const fileName of fileNames) {
            if (
                lstatSync(fileName).isDirectory() &&
                !path.basename(fileName).startsWith("_")
            ) {
                // If it's a subdirectory, recursively call the function
                const child = await buildModuleTree(fileName, relativePath);
                root.children.push(child);
            } else if (path.basename(fileName).includes("__init__")) {
                readFile(fileName, "utf8", async function (err, pythonCode) {
                    if (err) {
                        console.error(err.message);
                    } else {
                        let classesFunctionsImports =
                            extractClassesAndFunctions(pythonCode);
                        const __all__ = extractAllObjects(pythonCode);
                        console.log(
                            "Parsing __init__.py",
                            fileName,
                            classesFunctionsImports
                        );
                        root.classes = classesFunctionsImports[0];
                        root.functions = classesFunctionsImports[1];
                        root.imports = classesFunctionsImports[2];
                        root.__all__ = __all__;
                    }
                });
            } else if (
                lstatSync(fileName).isFile() &&
                fileName.endsWith(".py")
                // !path.basename(fileName).startsWith("_")
            ) {
                // If it's a Python module, add it as a child node
                const child = await parsePythonFile(fileName, relativePath);
                root.children.push(child);
            }
        }
        Database.setNode(uuid, root);
        return uuid;
    } else {
        console.log("Basename: ", path.basename(moduleFolder));
        // moduleFolder should be a directory, so this line should never be called
        return parsePythonFile(moduleFolder, relativePath);
    }
}
