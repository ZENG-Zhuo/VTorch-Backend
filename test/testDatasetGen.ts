import {defineDataset} from "../src/codeGen/genDataSetDef";
import { readFileSync, writeFileSync } from "fs";
import { DatasetInfo } from "../src/common/datasetTypes";
import { ImportManager, PythonFunc } from "../src/codeGen/pyCodeGen";
import { printNode } from "../src/codeGen/printNode";
import * as ast from "../src/codeGen/python_ast";

function doTest(dataset: DatasetInfo){
    let imports = new ImportManager();
    const ret = defineDataset(dataset, imports);
    console.log(printNode(ast.Module([...imports.toCode(), ...ret.definition, ast.Assignment("=", [ast.Name("dataset")], [ret.construction])])));
}

function test1(){
    let json = JSON.parse(readFileSync("torchvisionDataset.json", "utf-8"));
    doTest(DatasetInfo.fromJSON(json));
}

function test2(){
    let json = {
        "name": "11",
        "type": "TabularDatasetInfo",
        "config": {
            filePath: "hello/world.csv",
            targetColumn: "target",
            delimiter: "','",
            isNPY: false,
        }
    }
    doTest(DatasetInfo.fromJSON(json));
}

function test3(){
    let json = {
        "name": "12",
        "type": "SegmentationDatasetInfo",
        "config": {
            imgDir: "hello",
            maskDir: "world",
            transforms: [
                { "name": "Resize", "parameters": ["(256, 256)"] },
                { "name": "ToTensor", "parameters": [] }
            ]
        }
    }
    doTest(DatasetInfo.fromJSON(json));
}

function test4(){
    let json = {
        "name": "12",
        "type": "CustomCodeDatasetInfo",
        "config": {
            "code": `
from torchvision.datasets import MNIST
from torchvision.transforms import Compose, ToTensor, Normalize
class ABC:
    def __init__(self):
        pass
`, 
            "datasetDefinition": "MNIST(root=\"../data\",train=True,transform=Compose([ToTensor(), Normalize((0.1307,),(0.3081,))]),download=True)"
        }
    }
    doTest(DatasetInfo.fromJSON(json));
}

test4();