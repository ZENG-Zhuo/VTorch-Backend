import { Router } from "express";
import { readFileSync } from "fs";
import { extractAllObjects } from "../codeParse/parsePythonObject";
import { parseImportInfoRecursively, parsePackage } from "../codeParse/parsePythonPackage";
import { Database } from "../common/objectStorage";

export const codeParseRoute = Router();

codeParseRoute.post("/getAll", (req, res) => {
    console.log(process.cwd());
    console.log(req.body);
    let filePath = req.body.filePath;
    const code = readFileSync(filePath, "utf8");
    let allObjects = extractAllObjects(code);
    if (allObjects) {
        res.send(JSON.stringify(allObjects));
    } else {
        res.status(404).send("No __all__ in" + filePath);
    }
});

codeParseRoute.post("/parsePackage", (req, res) => {
    // console.log(req)
    let folderPath = req.body.folderPath;
    let root = parsePackage(folderPath);
    res.send("Starting to parse package at" + folderPath + " id: " + root);
});

codeParseRoute.post("/getPackageStat", (req, res) => {
    let id = req.body.id;
    res.send("The requested package stat: " + Database.getPackage(id).status);
});

codeParseRoute.post("/getPackage", (req, res) => {
    let id = req.body.id;
    res.send(Database.getPackage(id).toJSON());
});

codeParseRoute.post("/getNode", (req, res) => {
    let id = req.body.id;
    res.send(Database.getNode(id).toJSON());
});

codeParseRoute.post("/save", async (req, res) => {
    Database.save();
    res.send("Saved!");
});

codeParseRoute.post("/load", async (req, res) => {
    Database.load();
    res.send("Loaded!");
});


codeParseRoute.post("/getSubModuleInfo", async(req, res)=> {
    let id = req.body.id; // package id
    let relativePath = req.body.relativePath;
    res.send(Database.getPackage(id).getSubModule(relativePath));
})

codeParseRoute.post("/parseImport", async(req, res)=> {
    let id = req.body.id; // package id
    let relativePath = req.body.relativePath;
    const pack = Database.getPackage(id);
    const module = pack.getSubModule(relativePath);
    if (module){
        parseImportInfoRecursively(pack, module);
        res.send(Database.getNode(module).toJSON());
    }else{
        res.status(404).send("no such module")
    }
})