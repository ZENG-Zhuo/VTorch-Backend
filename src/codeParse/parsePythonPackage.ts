import {
    FileModuleNode,
    FolderModuleNode,
    NodeId,
    getBasename,
} from "../common/pythonFileTypes";
import { Package, PackageId } from "../common/pythonPackageType";
import { Database, nodeFromJSON } from "../common/objectStorage";
import { randomUUID } from "crypto";
import { buildModuleTree, parsePythonFile } from "./parsePythonModule";
import {
    existsSync,
    mkdirSync,
    readFileSync,
    statSync,
    writeFileSync,
} from "fs";
import { globSync } from "glob";
import path, { basename } from "path";

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
        let importSourceNodeId = undefined;
        const rootNode = pack.root ? Database.getNode(pack.root) : undefined;
        if (!rootNode) throw "pack uninitilized";
        const sourcePath =
            level != 0
                ? relativePath.slice(0, -level).concat(source.source)
                : relativePath.concat(source.source); // this need to be updated to find

        importSourceNodeId = pack.getSubModule(sourcePath, source.fromFile);
        if (!importSourceNodeId) {
            importSourceNodeId = pack.getSubModule(
                source.source,
                source.fromFile
            ); // eg. import torch.**/ import torch
        }

        if (importSourceNodeId) {
            // ignoring __all__ for now!
            const importSourceNode = Database.getNode(importSourceNodeId);
            const importees = i.importees;
            if (importees) {
                if (!importSourceNode.parsedImport)
                    parseImportInfo(pack, importSourceNode);
                if (importees == "*") {
                    const __all__ = importSourceNode.__all__;
                    let checkValid = (name: string) => {
                        return true;
                    };
                    if (__all__) {
                        checkValid = (name: string) => {
                            return __all__.includes(name);
                        };
                    }
                    importSourceNode.classes.map((classInfo) => {
                        if (checkValid(classInfo.name))
                            node.importedClasses.set(classInfo.name, [
                                classInfo.name,
                                importSourceNodeId,
                            ]);
                    });
                    importSourceNode.functions.map((funcInfo) => {
                        if (checkValid(funcInfo.name))
                            node.importedFunctions.set(funcInfo.name, [
                                funcInfo.name,
                                importSourceNodeId,
                            ]);
                    });
                    importSourceNode.importedClasses.forEach((value, alias) => {
                        if (checkValid(alias))
                            node.importedClasses.set(alias, value);
                    });
                    importSourceNode.importedFunctions.forEach(
                        (value, alias) => {
                            if (checkValid(alias))
                                node.importedFunctions.set(alias, value);
                        }
                    );
                    importSourceNode.importedModules.forEach((value, alias) => {
                        if (checkValid(alias))
                            node.importedModules.set(alias, value);
                    });
                    return;
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
                        return className === classInfo.name;
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
                        return funcName === funcInfo.name;
                    });
                    if (index >= 0) {
                        console.log("settting func:", alias, funcName);
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
                        // check if it is a class in importSourceNode
                        node.importedClasses.set(alias, ic);
                    } else {
                        const ifunc =
                            importSourceNode.importedFunctions.get(name);
                        if (ifunc) {
                            // check if it is a function in importSourceNode
                            console.log("settting func:", alias, ifunc);
                            node.importedFunctions.set(alias, ifunc);
                        } else {
                            const moduleId = importSourceNode.getSubModule(
                                [importSourceNode.name, name],
                                source.fromFile
                            );
                            if (moduleId) {
                                // check if it is a module in importSourceNode
                                node.importedModules.set(alias, [
                                    name,
                                    moduleId,
                                ]);
                            }
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

type Node = FileModuleNode | FolderModuleNode;

export function saveDatabase() {
    const packagesPath = path.join(storagePath, "packages");
    if (!existsSync(packagesPath)) mkdirSync(packagesPath);
    for (const entry of Database.packages.entries()) {
        writeFileSync(
            path.join(packagesPath, entry[0]),
            JSON.stringify(entry[1].toJSON())
        );
    }

    const nodesPath = path.join(storagePath, "nodes");
    if (!existsSync(nodesPath)) mkdirSync(nodesPath);
    for (const entry of Database.nodes.entries()) {
        writeFileSync(
            path.join(nodesPath, entry[0]),
            JSON.stringify(entry[1].toJSON())
        );
    }
}
const storagePath = "/home/zeng-zhuo/FYP/storage";
export function loadPackages(): Map<PackageId, Package> {
    let packages = new Map<PackageId, Package>();
    const packagesPath = path.join(storagePath, "packages");
    if (statSync(packagesPath).isDirectory()) {
        let files = globSync(path.join(packagesPath, "*"));
        for (const fileName of files) {
            let content = readFileSync(fileName, "utf8");
            let pack = Package.fromJSON(JSON.parse(content));
            packages.set(basename(fileName), pack);
        }
    }
    return packages;
}

export function loadNodes(): Map<NodeId, Node> {
    let nodes = new Map<NodeId, Node>();
    const nodesPath = path.join(storagePath, "nodes");

    if (statSync(nodesPath).isDirectory()) {
        let files = globSync(path.join(nodesPath, "*"));

        for (const fileName of files) {
            const content = readFileSync(fileName, "utf8");
            const json = JSON.parse(content);
            const node = nodeFromJSON(json);
            nodes.set(basename(fileName), node);
        }
    }

    return nodes;
}

export function loadDataBase() {
    Database.packages.clear();
    Database.nodes.clear();
    Database.packages = loadPackages();
    Database.nodes = loadNodes();
}
