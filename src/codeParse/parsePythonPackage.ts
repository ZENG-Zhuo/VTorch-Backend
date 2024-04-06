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
        const importSourceNodeId = pack.getSubModule(sourcePath);
        if (importSourceNodeId) {
            // ignoring __all__ for now!
            const importSourceNode = Database.getNode(importSourceNodeId);
            console.log(
                "============Parsing Import for Node: ",
                importSourceNode.relativePath,
                "============="
            );
            if (i.importees) {
                if (!importSourceNode.parsedImport)
                    parseImportInfo(pack, importSourceNode);
                if (i.importees == "*") {
                    throw "* import not implemented yet";
                }
                const importClasses = importSourceNode.classes.filter((c) =>
                    i.importees?.includes(c.name)
                );
                const importFunctions = importSourceNode.functions.filter((f) =>
                    i.importees?.includes(f.name)
                );
                importClasses.map((c) =>
                    node.importedClasses.set(c.name, importSourceNodeId)
                );
                importFunctions.map((f) =>
                    node.importedFunctions.set(f.name, importSourceNodeId)
                );
                i.importees.map((i) => {
                    const ic = importSourceNode.importedClasses.get(i);
                    if (ic) {
                        node.importedClasses.set(i, ic);
                    } else {
                        const ifunc = importSourceNode.importedFunctions.get(i);
                        if (ifunc) {
                            node.importedFunctions.set(i, ifunc);
                        }
                    }
                });
            } else {
                if (i.alias) {
                    node.importedModules.set(i.alias, importSourceNodeId);
                } else {
                    node.importedModules.set(
                        importSourceNode.name,
                        importSourceNodeId
                    );
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
