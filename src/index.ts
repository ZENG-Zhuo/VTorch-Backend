import express from "express";
import { extractAllObjects } from "./codeParse/parsePythonObject";
import { readFileSync } from "fs";
import bodyParser from "body-parser";
import { buildModuleTree } from "./codeParse/parsePythonModule";
import { CheckLogin, CreateUser, Login } from "./database/loginUtils";
import cookieParser from "cookie-parser";
import { parsePackage } from "./codeParse/parsePythonPackage";
import { Database } from "./common/objectStorage";

const app = express();
const port = 8001;
app.use(bodyParser.json());
app.use(cookieParser());

app.post("/api/getAll", (req, res) => {
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

app.post("/api/parsePackage", (req, res) => {
    // console.log(req)
    let folderPath = req.body.folderPath;
    let root = parsePackage(folderPath);
    res.send("Starting to parse package at" + folderPath + " id: " + root);
});

app.post("/api/getPackageStat", (req, res) => {
    let id = req.body.id;
    res.send("The requested package stat: "+ Database.getPackage(id).status);
});

app.post("/api/test/createUser", async (req, res, next) => {
    try {
        const answer = await CreateUser(
            req.body.username,
            req.body.password,
            req.body.email,
            req.body.name
        );
        res.send(answer);
    } catch (error) {
        return next(error);
    }
});

app.post("/api/login", async (req, res, next) => {
    try {
        const result = await Login(req.body.username, req.body.password);
        if (result.includes("-")) {
            res.cookie("username", req.body.username);
            res.cookie("session", result);
            res.send("Success");
        } else {
            res.send(result);
        }
    } catch (error) {
        return next(error);
    }
});

app.post("/api/testLogin", async (req, res, next) => {
    try {
        let result = await CheckLogin(
            req.cookies.username,
            req.cookies.session
        );
        if (result) res.send("OK");
        else res.send("Deny");
    } catch (error) {
        return next(error);
    }
});

app.get("/", (req, res) => {
    res.send("Hello!");
});

app.listen(port, () => {
    return console.log("Express is listening at http://localhost:" + port);
});
