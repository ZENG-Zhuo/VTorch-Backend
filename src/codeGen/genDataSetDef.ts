import { DatasetInfo, TorchvisionDatasetInfo, TransformInstance } from "../common/datasetTypes";
import { ImportManager, PythonFunc } from "./pyCodeGen";
import { SyntaxNode } from "./python_ast";
import * as ast from "./python_ast";

function toTransformName(name: string): ast.Dot{
    return ast.Dot(ast.Dot(ast.Name("torchvision"), "transforms"), name)
}

function transformToSyntax(tf: TransformInstance): SyntaxNode{
    let caller = toTransformName(tf.name);
    let args = tf.parameters.map(transformParamToSyntax);
    return ast.Call(caller, args);
}

function transformParamToSyntax(tfParam: string | TransformInstance[] | undefined): ast.Argument{
    switch(typeof(tfParam)){
        case "string":
            return ast.Argument(ast.Name(tfParam));
        case "undefined":
            return ast.Argument(ast.Literal(""));
        default:
            if(Array.isArray(tfParam))
                return ast.Argument(ast.Tuple(tfParam.map(transformToSyntax)))
            throw "Not reachable";
    }
}

function defineDataset(dataset: DatasetInfo, code: PythonFunc, imports: ImportManager, dataSetVarName: string = "dataset"): ast.Name{
    if(dataset instanceof TorchvisionDatasetInfo){
        imports.addAsStr("torchvision");
        imports.addAsStr("torchvision.transforms");
        imports.addAsStr("torchvision.datasets");

        function toTVDataset(name: string){
            return ast.Dot(ast.Dot(ast.Name("torchvision"), "datasets"), name);
        }

        let dataSetVar = ast.Name(dataSetVarName);
        code.body.push(
            ast.Assignment("=", [dataSetVar], [
                ast.Call(
                    toTVDataset(dataset.torchvisionDatasetName), 
                    dataset.initFuncParams.map(transformParamToSyntax)
            )]
        ));
        return dataSetVar;
    }
    else {
        throw "Not implemented";
    }
}