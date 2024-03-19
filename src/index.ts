import express from "express";
import {extractAllObjects} from "./codeParse/parsePythonObject"
import { readFileSync } from "fs";
import bodyParser from "body-parser";
import { buildModuleTree } from "./codeParse/parsePythonModule";
const app = express();
const port = 8001;
app.use(bodyParser.json());

app.post("/api/getAll", (req, res) => {
    // console.log(req)
    console.log(process.cwd());
    console.log(req.body);
    let filePath = req.body.filePath;
    const code = readFileSync(filePath, "utf8");
    let allObjects = extractAllObjects(code);
    if (allObjects){
        res.send(JSON.stringify(allObjects));
    } else{
        res.status(404).send("No __all__ in"+ filePath);
    }
});

app.post("/api/parseModule", (req, res) => {
    // console.log(req)
    let folderPath = req.body.folderPath;
    let root = buildModuleTree(folderPath);
    res.send(JSON.stringify(root.toJSON()));
});

app.get("/", (req, res) => {
  res.send("Hello!");
});

app.listen(port, () => {
  return console.log("Express is listening at http://localhost:" + port);
});
