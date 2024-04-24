import { DatasetInfo, DatasetType, SegmentationDatasetInfo, TabularDatasetInfo, TorchvisionDatasetInfo, TransformInstance } from "../common/datasetTypes";
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
    console.log("transforming", tfParam);
    if(!tfParam)
        return ast.Argument(ast.Literal(""));
    else if(typeof(tfParam) == "string")
        return ast.Argument(ast.Name(tfParam));
    else 
        return ast.Argument(ast.Tuple(tfParam.map(transformToSyntax)));
}

abstract class DatasetTransformer<DT>{
    abstract define(dataset: DT, imports: ImportManager): {
        definition: SyntaxNode[],
        construction: SyntaxNode
    }
}

class TorchVisionDatasetTransformer extends DatasetTransformer<TorchvisionDatasetInfo>{
    define(dataset: TorchvisionDatasetInfo, imports: ImportManager): { definition: SyntaxNode[]; construction: SyntaxNode; } {
        imports.addAsStr("torchvision");
        imports.addAsStr("torchvision.transforms");
        imports.addAsStr("torchvision.datasets");

        function toTVDataset(name: string){
            return ast.Dot(ast.Dot(ast.Name("torchvision"), "datasets"), name);
        }

        let construction = ast.Call(
            toTVDataset(dataset.torchvisionDatasetName), 
            dataset.initFuncParams.map(transformParamToSyntax)
        );
        return {definition: [], construction};
    }
}

class TabularDatasetTransformer extends DatasetTransformer<TabularDatasetInfo>{
    define(dataset: TabularDatasetInfo, imports: ImportManager): { definition: SyntaxNode[]; construction: SyntaxNode; } {
        imports.addAsStr("torch");
        imports.addAsStr("torch.utils.data");

        // define __init__
        const initBody: SyntaxNode[] = [];
        if(dataset.config.isNPY){
            imports.addAsStr("numpy");
            initBody.push(ast.CodeLine(`self.data = numpy.load("${dataset.config.filePath}")`));
        }
        else {
            imports.addAsStr("pandas");
            initBody.push(ast.CodeLine(`self.data = pandas.read_csv("${dataset.config.filePath}", delimiter=${dataset.config.delimiter})`));
        }
        if(dataset.config.targetColumn)
            initBody.push(ast.CodeLine(`self.targetColumn = "${dataset.config.targetColumn}"`));
        const initFunction = ast.Def("__init__", [ast.Parameter("self")], initBody);

        // define __len__
        const lenFunction = ast.Def("__len__", [ast.Parameter("self")], [ast.CodeLine("return len(self.data)")]);

        // define __getitem__
        const getItemBody: SyntaxNode[] = [];
        if(dataset.config.targetColumn){
            getItemBody.push(ast.CodeLine("x = self.data.drop(columns=[self.targetColumn]).iloc[idx].values"));
            getItemBody.push(ast.CodeLine("y = self.data[self.targetColumn].iloc[idx]"));
            getItemBody.push(ast.CodeLine("return torch.tensor(x, dtype=torch.float32), torch.tensor(y, dtype=torch.float32)"));
        }
        else {
            getItemBody.push(ast.CodeLine("x = self.data.iloc[idx].values"));
            getItemBody.push(ast.CodeLine("return torch.tensor(x, dtype=torch.float32)"));
        }
        const getItemFunction = ast.Def("__getitem__", [ast.Parameter("self"), ast.Parameter("idx")], getItemBody);

        let classDef = ast.Class("TabularDataset", [ast.CodeLine("torch.utils.data.Dataset")], [
            initFunction, lenFunction, getItemFunction
        ]);
        return {definition: [classDef], construction: ast.CodeLine("TabularDataset()")};
    }
}

class SegmentationDatasetTransformer extends DatasetTransformer<SegmentationDatasetInfo>{
    makeAssignMember(memberName: string, value: SyntaxNode): ast.Assignment{
        return ast.Assignment("=", [ast.Dot(ast.Name("self"), memberName)], [value]);
    }
    define(dataset: SegmentationDatasetInfo, imports: ImportManager): { definition: SyntaxNode[]; construction: SyntaxNode; } {
        imports.addAsStr("torch");
        imports.addAsStr("torch.utils.data");
        imports.addAsStr("os");
        imports.addAsStr("torchvision");
        imports.addAsStr("PIL");

        // define __init__
        const initBody: SyntaxNode[] = [];
        initBody.push(ast.CodeLine(`self.imgDir = "${dataset.config.imgDir}"`));
        initBody.push(ast.CodeLine(`self.maskDir = "${dataset.config.maskDir}"`));
        if(dataset.config.transforms.length > 0)
            initBody.push(ast.Assignment("=", [ast.CodeLine("self.transforms")], [transformParamToSyntax(dataset.config.transforms).actual]));
        
        initBody.push(ast.CodeLine("self.imgPaths = sorted(os.listdir(self.imgDir))"));
        initBody.push(ast.CodeLine("self.maskPaths = sorted(os.listdir(self.maskDir))"));
        const initFunction = ast.Def("__init__", [ast.Parameter("self")], initBody);

        // define __len__
        const lenFunction = ast.Def("__len__", [ast.Parameter("self")], [ast.CodeLine("return len(self.imgPaths)")]);

        // define __getitem__
        const getItemBody: SyntaxNode[] = [];
        getItemBody.push(ast.CodeLine("imgPath = os.path.join(self.imgDir, self.imgPaths[idx])"));
        getItemBody.push(ast.CodeLine("maskPath = os.path.join(self.maskDir, self.maskPaths[idx])"));
        getItemBody.push(ast.CodeLine("image = PIL.Image.open(imgPath).convert(\"RGB\")"));
        getItemBody.push(ast.CodeLine("mask = PIL.Image.open(maskPath).convert(\"L\")"));
        if(dataset.config.transforms.length > 0){
            getItemBody.push(ast.CodeLine("image = self.transforms(image)"));
            getItemBody.push(ast.CodeLine("mask = self.transforms(mask)"));
        }
        getItemBody.push(ast.CodeLine("return image, mask"));
        
        const getItemFunction = ast.Def("__getitem__", [ast.Parameter("self"), ast.Parameter("idx")], getItemBody);

        let classDef = ast.Class("SegmentationDataset", [ast.CodeLine("torch.utils.data.Dataset")], [
            initFunction, lenFunction, getItemFunction
        ]);
        return {definition: [classDef], construction: ast.CodeLine("SegmentationDataset()")};
    }
}

export function defineDataset(dataset: DatasetInfo, imports: ImportManager): {
    definition: SyntaxNode[],
    construction: SyntaxNode
}{
    switch (dataset.type as DatasetType) {
        case "TorchvisionDatasetInfo":
            return (new TorchVisionDatasetTransformer).define(dataset as TorchvisionDatasetInfo, imports);;
        case "TabularDatasetInfo":
            return (new TabularDatasetTransformer).define(dataset as TabularDatasetInfo, imports);
        case "SegmentationDatasetInfo":
            return (new SegmentationDatasetTransformer).define(dataset as SegmentationDatasetInfo, imports);
        case "CustomCodeDatasetInfo":
        default:
            throw new Error("Invalid dataset type");
    }
}