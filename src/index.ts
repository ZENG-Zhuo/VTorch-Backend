import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { routes } from "./routes/routes";

const app = express();
const port = 8001;
app.use(bodyParser.json({ limit: "50mb" }));
app.use(cookieParser());
app.use("/api", routes);

app.get("/", (req, res) => {
    res.send("Hello!");
});

app.listen(port, () => {
    return console.log("Express is listening at http://localhost:" + port);
});
