import { FileModuleNode, FolderModuleNode } from "../common/pythonFileTypes";
import { LayerGraph, Block, INPUTBLKID, OUTPUTBLKID, LayerBlock, LiteralBlock, EdgeEndpoint, InputBlock, OutputBlock, FunctionBlock } from "./graphBlock";
import { SyntaxNode } from "./python_ast";
import * as ast from "./python_ast";


function toValidName(varName: string): string {
    const regex = /[^a-zA-Z0-9]+/g;
    return varName.replace(regex, '_');
}

class VarNameGenerator{
    private x: number = 22;
    public genFlowVar(prefex: string = ""){
      this.x = (this.x+1)%26;
      return prefex + String.fromCharCode(this.x + 97);
    }
    reset() {this.x = 22;}
}

class PythonFunc{
    params: ast.Name[] = [];
    body: SyntaxNode[] = [];
    retVals: SyntaxNode[] = [];

    toFuncDef(name: string, isMember: boolean): ast.Def{
        let allParams: ast.Name[] = isMember ? [ast.Name("self"), ...this.params] : this.params;
        let allBody: SyntaxNode[] = this.retVals.length > 0 ? [...this.body, ast.Return(this.retVals)] : this.body;
        return ast.Def(name, allParams.map(x => ast.Parameter(x.id)), allBody);
    }
}

class ImportManager{
    importList: Set<string> = new Set();
    add(modul: FileModuleNode | FolderModuleNode){
        this.importList.add(modul.relativePath.join("."));
    }
}

abstract class Environment{
    readonly idToVar: Map<string, SyntaxNode> = new Map();
    readonly varNameGenerator = new VarNameGenerator();

    readonly varDefField: PythonFunc;
    readonly graph: LayerGraph;
    readonly importManager: ImportManager;
    readonly abstract genVar: (blk: Block) => ast.Dot | ast.Name;
    readonly abstract layerNodeFuncName: string;
    readonly abstract getLayerFuncCalled: (blk: LayerBlock) => SyntaxNode;
    static readonly self = ast.Name("self");

    constructor(varDefField: PythonFunc, graph: LayerGraph, imports: ImportManager){
        this.varDefField = varDefField;
        this.graph = graph;
        this.importManager = imports;
    }

    // return the member variable
    private addVarDefine(blk: Block, value: SyntaxNode, memberName?: string): SyntaxNode{
        let thisVar = this.genVar(blk);
            this.varDefField.body.push(
                ast.Assignment("=", 
                [thisVar], 
                [value]
            ));
        this.idToVar.set(blk.blockId, thisVar);
        return thisVar;
    }

    private edgesToArgs(argEdges: [string, EdgeEndpoint | EdgeEndpoint[]][]): ast.Argument[]{
        return argEdges.map(([paramName, edges]) => {
            if(edges instanceof EdgeEndpoint){
                return ast.Argument(this.toValue(edges), ast.Name(paramName));
            }
            else {
                return ast.Argument(ast.Tuple(edges.map(x => this.toValue(x))), ast.Name(paramName));
            }
        });
    }

    // (["torch", "nn"], "conv2d") => torch.nn.conv2d 
    protected pathToFunc(path: string[], callName: string): SyntaxNode{
        let fullPath = [...path, callName];
        return fullPath.slice(1).reduce((pre, nxt) => ast.Dot(pre, nxt), ast.Name(fullPath[0]) as SyntaxNode);
    }

    addBlock(blk: Block): SyntaxNode{
        if(this.idToVar.has(blk.blockId))
            return this.idToVar.get(blk.blockId)!;
        if(blk instanceof LayerBlock){
            this.importManager.add(blk.fileInfo);
            let args = this.edgesToArgs(blk.gratherArgs(this.layerNodeFuncName));
            let constr = this.getLayerFuncCalled(blk);
            return this.addVarDefine(blk, ast.Call(constr, args));
        }
        else if(blk instanceof FunctionBlock){
            this.importManager.add(blk.fileInfo);
            let fwdArgs = this.edgesToArgs(blk.gratherArgs("fwd"));
            let func = this.pathToFunc(blk.fileInfo.relativePath, blk.blockFunc.name);
            
            if(Array.from(blk.fTar.values()).flatMap(x => x).length <= 1){ // function is called only once
                return ast.Call(func, fwdArgs);
            }
            else {
                return this.addVarDefine(blk, ast.Call(func, fwdArgs));
            }
        }
        else if(blk instanceof OutputBlock){
            let fwdArgs = this.edgesToArgs(blk.gratherArgs("fwd"));
            return fwdArgs.length == 1 ? fwdArgs[0].actual : ast.Tuple(fwdArgs.map(x => x.actual));
        }
        else 
            throw "Not reachable"
    }
    toValue(edge: EdgeEndpoint): ast.SyntaxNode{
        let blk = this.graph.get(edge.nodeID)!;
        let tmp: SyntaxNode;
        if(blk instanceof LiteralBlock)
            tmp = ast.Name(blk.getText());
        else if(this.idToVar.has(edge.nodeID))
            tmp = this.idToVar.get(edge.nodeID)!;
        else {
            tmp = this.addBlock(blk);
        }
        if(edge.slotIdx){
            tmp = ast.Index(tmp, [ast.Name(edge.slotIdx)]);
        }
        return tmp;
    }

    getVar(id: string){
        if(!this.idToVar.has(id))
            return this.addBlock(this.graph.get(id)!);
        return this.idToVar.get(id);
    }
}

class ClassEnv extends Environment{
    readonly genVar: (blk: Block) => ast.Dot | ast.Name;
    readonly layerNodeFuncName: string;
    readonly getLayerFuncCalled: (blk: LayerBlock) => SyntaxNode;

    constructor(varDefField: PythonFunc, graph: LayerGraph, imports: ImportManager){
        super(varDefField, graph, imports);

        this.genVar = blk => ast.Dot(Environment.self, toValidName(blk.blockId));
        this.layerNodeFuncName = "ini";
        this.getLayerFuncCalled = blk => this.pathToFunc(blk.fileInfo.relativePath, blk.blockClass.name);
    }
}

class ForwardEnv extends Environment{
    readonly genVar: (blk: Block) => ast.Dot | ast.Name;
    readonly layerNodeFuncName: string;
    readonly getLayerFuncCalled: (blk: LayerBlock) => SyntaxNode;

    constructor(varDefField: PythonFunc, graph: LayerGraph, imports: ImportManager, outerEnv: ClassEnv){
        super(varDefField, graph, imports);

        this.genVar = _ => ast.Name(this.varNameGenerator.genFlowVar());
        this.layerNodeFuncName = "fwd";
        this.getLayerFuncCalled = blk => outerEnv.getVar(blk.blockId)!;
    }

    setAsParam(blk: Block, paramName?: ast.Name){
        let param = paramName || ast.Name(this.varNameGenerator.genFlowVar());
        this.idToVar.set(blk.blockId, param);
        this.varDefField.params.push(param);
    }

    setAsReturn(blk: Block){
        let retV = this.addBlock(blk);
        this.varDefField.retVals.push(retV);
    }
}

function transformDataflow(graph: LayerGraph, imports: ImportManager, startFrom: Block, endingAt: Block) {
    const forwardFunc = new PythonFunc();
    const initFunc = new PythonFunc();
    initFunc.body.push(ast.Call(ast.Dot(ast.Call(ast.Name("super"), []), "__init__"), []));
    const classEnv = new ClassEnv(initFunc, graph, imports);
    const forwardEnv = new ForwardEnv(forwardFunc, graph, imports, classEnv);

    forwardEnv.setAsParam(startFrom);
    forwardEnv.setAsReturn(endingAt);

    return {init: initFunc.toFuncDef("__init__", true), forward: forwardFunc.toFuncDef("forward", true)};
}

export function genModelClass(graph: LayerGraph, modelName: string){
    let imports = new ImportManager();
    let {init, forward} = transformDataflow(graph, imports, graph.inputBlock, graph.outputBlock);
    const classDef = ast.Class(modelName + "_layers", [ast.Dot(ast.Dot(ast.Name("torch"), "nn"), "Module")], [
        init, 
        forward
    ]);
    return classDef;
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