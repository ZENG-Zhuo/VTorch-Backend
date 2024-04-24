import { FileModuleNode, FolderModuleNode } from "../common/pythonFileTypes";
import { genModelClass } from "./genModelDef";
import { LayerGraph } from "./graphBlock";
import { SyntaxNode } from "./python_ast";
import * as ast from "./python_ast";

export class PythonFunc{
    params: ast.Name[] = [];
    body: SyntaxNode[] = [];
    retVals: SyntaxNode[] = [];

    toFuncDef(name: string, isMember: boolean): ast.Def{
        let allParams: ast.Name[] = isMember ? [ast.Name("self"), ...this.params] : this.params;
        let allBody: SyntaxNode[] = this.retVals.length > 0 ? [...this.body, ast.Return(this.retVals)] : this.body;
        return ast.Def(name, allParams.map(x => ast.Parameter(x.id)), allBody);
    }
}
export class ImportManager{
    importList: Set<string> = new Set();
    add(modul: FileModuleNode | FolderModuleNode){
        this.importList.add(modul.relativePath.join("."));
    }
    addAsStr(path: string){
        this.importList.add(path);
    }
    toCode(): ast.Import[]{
        return Array.from(this.importList).map(str => ast.Import([{path: str, location: ""}]));
    }
}
export abstract class GeneratedClass{
    readonly definition: SyntaxNode[]; 
    readonly construction: SyntaxNode;
    constructor(definition: SyntaxNode[], construction: SyntaxNode){
        this.definition = definition;
        this.construction = construction;
    }
}
export class GeneratedModelClass extends GeneratedClass{
    readonly inputCount: Number;
	readonly groundCount: Number;
	readonly outputCount: Number;
    constructor(definition: SyntaxNode[], construction: SyntaxNode, inputCount: Number, groundCount: Number, outputCount: Number){
        super(definition, construction);
		this.inputCount = inputCount;
		this.groundCount = groundCount;
		this.outputCount = outputCount;
    }
}

export class GeneratedDataset extends GeneratedClass{
    // readonly itemIsTuple: boolean;
    // constructor(definition: SyntaxNode[], construction: SyntaxNode, itemIsTuple: boolean){
    //     super(definition, construction);
    //     this.itemIsTuple = itemIsTuple;
    // }
}

export function genTrainingClass(modelName: string, lossName: string){
    let initFunc = new PythonFunc();
    const selfModel = ast.Dot(ast.Name("self"), "model");
    const selfLoss = ast.Dot(ast.Name("self"), "lossFunction");
    // initFunc.body.push(ast.Call(ast.Dot(ast.Call(ast.Name("super"), []), "__init__"), []));
    initFunc.body.push(
                    ast.Assignment("=", 
                    [selfModel], 
                    [ast.Call(ast.Name(modelName), [])]
    ));
    initFunc.body.push(
        ast.Assignment("=", 
        [selfLoss], 
        [ast.Call(ast.Name(lossName), [])]
    ));

    let loopBody: SyntaxNode[] = [];
    let astOptimizerVar = ast.Name("optimizer");
    let makeForLoop = (code: ast.SyntaxNode[]) => ast.For([ast.Name("batch_idx"), ast.Name("data"), ast.Name("target")], [ast.Call(ast.Name("enumerate"), [ast.Argument(ast.Name("data_loader"))])], code);

    loopBody.push(
        ast.Assignment("=", 
        [ast.Name("output")], 
        [ast.Call(selfModel, [ast.Argument(ast.Name("data"))])]
    ));
    loopBody.push(
        ast.Assignment("=", 
        [ast.Name("loss")], 
        [ast.Call(selfLoss, [ast.Argument(ast.Name("output")), ast.Argument(ast.Name("target"))])]
    ));

    loopBody.push(ast.Call(ast.Dot(astOptimizerVar, "zero_grad"), []));
    loopBody.push(ast.Call(ast.Dot(ast.Name("loss"), "backward"), []));
    loopBody.push(ast.Call(ast.Dot(astOptimizerVar, "step"), []));
    
    loopBody.push(ast.If(ast.BinaryOperator("==", ast.BinaryOperator("%", ast.Name("batch_idx"), ast.Literal(100)), ast.Literal(0)), 
        [ast.Call(ast.Name("print"), [ast.Argument(ast.Name("f\"Training Loss: {loss}\""))])],
        [], ast.Else([])
    ));
    

    let optimizerType = ast.Dot(ast.Dot(ast.Name("torch"), "nn"), "Adam");     //torch.nn.Adam

    let trainFunc = new PythonFunc();
    trainFunc.body.push(ast.Assignment("=", [astOptimizerVar], [ast.Call(optimizerType, [])]));
    trainFunc.body.push(makeForLoop(loopBody));

    return ast.Class("Training", [], [
        initFunc.toFuncDef("__init__", true),
        trainFunc.toFuncDef("train", true)
    ]);
}

export function genAll(graphs: LayerGraph[]): SyntaxNode{
    let imports = new ImportManager();
    let graphClasses = graphs.map(g => genModelClass(g, imports));
    return ast.Module([...imports.toCode(), ...graphClasses]);
}

export function generateAll(dataSet: GeneratedDataset, model: GeneratedModelClass, loss: GeneratedModelClass, imports: ImportManager): ast.Module{
    // zip: [A, A, A], [B, B, B] => [A, B], [A, B], [A, B]
    function zip<T, U>(array1: T[], array2: U[]): [T, U][]{
        return array1.map((e, i) => [e, array2[i]] as [T, U]);
    }

    const selfModel = "self.model";
    const selfLoss = "self.lossFunction";
    const selfDataset = "self.dataset";

    let initFunc = new PythonFunc();
    zip([selfDataset, selfModel, selfLoss], [dataSet, model, loss]).forEach(([v, g]) => 
        initFunc.body.push( ast.Assignment("=", [ast.CodeLine(v)], [g.construction]) )
    );

    const trainFunc = new PythonFunc();
    const optimizer = "optimizer";
    const dataLoder = "dataloader";

    trainFunc.body.push(ast.CodeLine(`${optimizer} = torch.nn.Adam()`));
    trainFunc.body.push(ast.CodeLine(`${dataLoder} = torch.utils.data.DataLoader(${selfDataset})`));

    const loopBody: SyntaxNode[] = [];
    const batch_index = "batch_index";
    const inputs = "inputs";
    const targets = "targets";
    trainFunc.body.push(
        ast.For([ast.CodeLine(`${batch_index}, (${inputs}, ${targets})`)], [ast.CodeLine(`enumerate(${dataLoder})`)], loopBody)
    );
    loopBody.push(ast.CodeLine(`${optimizer}.zero_grad()`));
    loopBody.push(ast.CodeLine(`outputs = ${selfModel}(${inputs})`));
    loopBody.push(ast.CodeLine(`loss = ${selfLoss}(outputs, ${targets})`));
    loopBody.push(ast.CodeLine(`loss.backward()`));
    loopBody.push(ast.CodeLine(`${optimizer}.step()`));
    loopBody.push(ast.If(ast.CodeLine(`${batch_index} % 100 == 0`), [
        ast.CodeLine(`print(f\"Batch: {${batch_index}}, Training Loss: {loss}\")`)
    ], []));
    return ast.Module([
        ...imports.toCode(),
        ...[dataSet, model, loss].flatMap(x => x.definition),
        ast.Class("Training", [], [
            initFunc.toFuncDef("__init__", true),
            trainFunc.toFuncDef("train", true)
        ])
    ]);
}