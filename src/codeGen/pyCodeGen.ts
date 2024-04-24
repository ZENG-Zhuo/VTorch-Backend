import { DatasetInfo } from "../common/datasetTypes";
import { Database } from "../common/objectStorage";
import { OptimizerConfig } from "../common/optimizerTypes";
import { FileModuleNode, FolderModuleNode } from "../common/pythonFileTypes";
import { ParameterInfo } from "../common/pythonObjectTypes";
import { defineDataset } from "./genDataSetDef";
import { genModel, genModelClass } from "./genModelDef";
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

// zip: [A, A, A], [B, B, B] => [A, B], [A, B], [A, B]
export function zip<T, U>(array1: T[], array2: U[]): [T, U][]{
    return array1.map((e, i) => [e, array2[i]] as [T, U]);
}
export function getParamNames(name: string, path: string[], imports: ImportManager): ParameterInfo[] | undefined{
    imports.addAsStr(path.join("."));
    let packageId = Database.findPackage(path[0], "1.0.0");
    if (packageId){
        const torch = Database.getPackage(packageId);
        const datasetsID = torch.getSubModule(path, false);
        if (datasetsID){
            const nn = Database.getNode(datasetsID);
            const module = nn.getClass(name);
            return module?.getFunctions("__init__").at(0)?.parameters;
        }
    }
}

export function optimizerGen(opt: OptimizerConfig, imports: ImportManager, modelVarName: string): ast.Call{
    const params = getParamNames(opt.name, ["torch", "optim"], imports);
    const args = [ast.CodeLine(`${modelVarName}.parameters()`), ...opt.parameters.map(x => x ? ast.CodeLine(x) : ast.Name("None"))];
    let realArgs: ast.Argument[];
    if(params){
        realArgs = zip(args, params.slice(1))
            .filter(([x, _]) => x.type == ast.CODELINE)
            .map(([a, p]) => ast.Argument(a, ast.Name(p.name)));
    }
    else realArgs = args.map(a => ast.Argument(a));
    return ast.Call(ast.Dot(ast.CodeLine("torch.optim"), opt.name), realArgs);
}

export function dataloaderGen(dlArgs: string[], imports: ImportManager, datasetVarName: string) {
    const params = getParamNames("DataLoader", ["torch", "utils", "data"], imports);
    const args = [ast.CodeLine(datasetVarName), ...dlArgs.map(x => x == "" ? ast.Name("None") : ast.CodeLine(x))];
    let realArgs: ast.Argument[];
    if(params){
        realArgs = zip(args, params.slice(1))
            .filter(([x, _]) => x.type == ast.CODELINE)
            .map(([a, p]) => ast.Argument(a, ast.Name(p.name)));
    }
    else realArgs = args.map(a => ast.Argument(a));
    return ast.Call(ast.CodeLine("torch.utils.data.DataLoader"), realArgs);
}

export function genAll(graphs: LayerGraph[]): SyntaxNode{
    let imports = new ImportManager();
    let graphClasses = graphs.map(g => genModelClass(g, imports));
    return ast.Module([...imports.toCode(), ...graphClasses]);
}

export function generateAll(dataSetInfo: DatasetInfo, modelGraph: LayerGraph, lossGraph: LayerGraph, optim: OptimizerConfig, loader: string[]): ast.Module{
    const imports = new ImportManager();
    const dataSet : GeneratedDataset = defineDataset(dataSetInfo, imports);
    const model: GeneratedModelClass = genModel(modelGraph, imports);
    const loss: GeneratedModelClass = genModel(lossGraph, imports);

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

    trainFunc.body.push(ast.Assignment("=", [ast.Name(optimizer)], [optimizerGen(optim, imports, selfModel)]));
    trainFunc.body.push(ast.Assignment("=", [ast.Name(dataLoder)], [dataloaderGen(loader, imports, selfDataset)]));

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
        ast.CodeLine(`print(\"Batch: {}, Training Loss: {}\".format(${batch_index}, loss))`)
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