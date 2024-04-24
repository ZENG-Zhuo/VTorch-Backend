import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { routes } from "./routes/routes";
import cors from "cors";
import { loadDataBase } from "./codeParse/parsePythonPackage";

const app = express();
const port = 8001;
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(cookieParser());
app.use("/api", routes);
loadDataBase();
app.get("/", (req, res) => {
    res.send("Hello!");
});

app.listen(port, () => {
    return console.log("Express is listening at http://localhost:" + port);
});
