import { statSync } from "fs";
import {
    FileModuleNode,
    FolderModuleNode,
    NodeId,
    getBasename,
} from "../common/pythonFileTypes";
import { Package, PackageId } from "../common/pythonPackageType";
import { Database } from "../common/objectStorage";
import { randomUUID } from "crypto";
import { buildModuleTree, parsePythonFile } from "./parsePythonModule";
export function parseImportInfoRecursively(pack: Package, nodeId: NodeId) {
    let node = Database.getNode(nodeId);
    parseImportInfo(pack, node);
    if (node instanceof FolderModuleNode) {
        node.children.map((id) => parseImportInfoRecursively(pack, id));
    }
}

function parseImportInfo(
    pack: Package,
    node: FileModuleNode | FolderModuleNode
) {
    if (node.parsedImport) {
        return;
    }
    node.parsedImport = true; // avoid infinite import
    const relativePath = node.relativePath;
    node.imports.map((i) => {
        const source = i.source;
        let level = source.level;
        if (node instanceof FileModuleNode) {
            level += 1;
        }
        if (level >= relativePath.length) {
            throw "out of package relative import!";
        }
        const sourcePath =
            level != 0
                ? relativePath.slice(0, -level).concat(source.source)
                : relativePath.concat(source.source); // this need to be updated to find
        const importSourceNodeId = pack.getSubModule(
            sourcePath,
            source.fromFile
        );
        if (importSourceNodeId) {
            // ignoring __all__ for now!
            const importSourceNode = Database.getNode(importSourceNodeId);
            console.log(
                "============Parsing Import for Node: ",
                importSourceNode.relativePath,
                "============="
            );
            const importees = i.importees;
            if (importees) {
                if (!importSourceNode.parsedImport)
                    parseImportInfo(pack, importSourceNode);
                if (importees == "*") {
                    throw "* import not implemented yet";
                }
                importSourceNode.classes.map((classInfo) => {
                    let alias: string = "";
                    let className: string = "";
                    const index = importees.findIndex((importee) => {
                        if (typeof importee === "string") {
                            alias = importee;
                            className = importee;
                        } else {
                            className = importee[0];
                            alias = importee[1];
                        }
                        return (className === classInfo.name);
                    });
                    if (index >= 0) {
                        node.importedClasses.set(alias, [
                            className,
                            importSourceNodeId,
                        ]);
                    }
                });
                importSourceNode.functions.map((funcInfo) => {
                    let alias: string = "";
                    let funcName: string = "";
                    const index = importees.findIndex((importee) => {
                        if (typeof importee === "string") {
                            alias = importee;
                            funcName = importee;
                        } else {
                            funcName = importee[0];
                            alias = importee[1];
                        }
                        return (funcName === funcInfo.name);
                    });
                    if (index >= 0) {
                        console.log(
                            "settting func:",
                            alias,
                            funcName,
                        );
                        node.importedFunctions.set(alias, [
                            funcName,
                            importSourceNodeId,
                        ]);
                    }
                });

                importees.map((importee) => {
                    let alias = "";
                    let name = "";
                    if (typeof importee === "string") {
                        alias = name = importee;
                    } else {
                        name = importee[0];
                        alias = importee[1];
                    }
                    // find import recursively from importSourceNode
                    const ic = importSourceNode.importedClasses.get(name);
                    if (ic) {
                        node.importedClasses.set(alias, ic);
                    } else {
                        const ifunc =
                            importSourceNode.importedFunctions.get(name);
                        if (ifunc) {
                            console.log("settting func:", alias, ifunc);
                            node.importedFunctions.set(alias, ifunc);
                        }
                    }
                });
            } else {
                if (i.alias) {
                    node.importedModules.set(i.alias, [
                        importSourceNode.name,
                        importSourceNodeId,
                    ]);
                } else {
                    node.importedModules.set(importSourceNode.name, [
                        importSourceNode.name,
                        importSourceNodeId,
                    ]);
                }
            }
        } else {
            console.log(
                "can't find import for module: ",
                relativePath,
                "import path: ",
                source.source
            );
        }
    });
}
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
                // will not parse import in a file module
            });
        } else {
            buildModuleTree(filePath, []).then((root) => {
                pythonPackage.root = root;
                pythonPackage.status = "ready";
                // parse importInfo to concrete link
                // parseImportInfoRecursively(pythonPackage, root);
            });
        }
        const uuid = randomUUID();
        Database.setPackage(uuid, pythonPackage);
        return uuid;
    } catch (error) {
        throw "Invaild file path: " + filePath;
    }
}
