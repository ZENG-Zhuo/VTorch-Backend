import { Router } from "express";
import { DatasetInfo } from "../common/datasetTypes";

export const datasetsRouter = Router();

const datasets: Map<string, DatasetInfo> = new Map();

datasetsRouter.post("/setDatasetInfo", async (req, res) => {
    const name = req.body.name;
    const datasetInfoJSON = req.body.datasetInfo;
    datasets.set(name, DatasetInfo.fromJSON(JSON.parse(datasetInfoJSON)));
    console.log("Receiving: ", req.body.datasetInfo);
    console.log("datasets: ", datasets);
    res.send("Sucess");
});

datasetsRouter.post("/getDatasetInfos", async (req, res) => {
    res.json(Array.from(datasets.entries()));
});
