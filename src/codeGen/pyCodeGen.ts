import { LayerGraph, Block, INPUTBLKID, OUTPUTBLKID, LayerBlock, LiteralBlock, EdgeEndpoint, InputBlock, OutputBlock } from "./graphBlock";
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

export function genPython(graph: LayerGraph, modelName: string = "MyModel"): ast.Module{
    class MemberTracker{
        memberVar: Map<string, SyntaxNode> = new Map();
        initBody: SyntaxNode[] = [];
        addAsMember(blkId: string, blk: Block){
            if(blk instanceof LayerBlock){
                // let constrInfo = blk.blockClass.functions.find(f => f.name == "__init__")!;
                let path = blk.fileInfo.relativePath.join(".");
                importList.add(path);
                let iniArgs: ast.Argument[] = [];
                Array.from(blk.fSrc).forEach(([edgKey, edgeEnd]) => {
                    let splittedKey = edgKey.split("-");
                    if(splittedKey[0] != "ini" || edgeEnd.length == 0)
                        return;
                    let paramName = splittedKey[1];
                    let args = edgeEnd.map(e => this.toValue(e));
                    let actualArg = (args.length > 1) ? ast.Argument(ast.Tuple(args), ast.Name(paramName)) : ast.Argument(args[0], ast.Name(paramName));
                    iniArgs.push(actualArg);
                });
                let thisMemberVar = ast.Dot(ast.Name("self"), toValidName(blkId));
                let constructorPath = [...blk.fileInfo.relativePath, blk.blockClass.name];
                let caller = constructorPath.slice(1).reduce((pre, nxt) => ast.Dot(pre, nxt), ast.Name(constructorPath[0]) as SyntaxNode);
                
                this.initBody.push(
                    ast.Assignment("=", 
                    [thisMemberVar], 
                    [ast.Call(caller, iniArgs)]
                ));
                this.memberVar.set(blkId, thisMemberVar);
            }
        }
    
        toValue(edge: EdgeEndpoint): ast.SyntaxNode{
            let blk = graph.get(edge.nodeID)!;
            let tmp: SyntaxNode;
            if(blk instanceof LiteralBlock)
                tmp = ast.Name(blk.getText());
            else if(this.memberVar.has(edge.nodeID))
                tmp = this.memberVar.get(edge.nodeID)!;
            else {
                this.addAsMember(edge.nodeID, blk);
                tmp = this.memberVar.get(edge.nodeID)!;
            }
            if(edge.slotIdx){
                tmp = ast.Index(tmp, [ast.Name(edge.slotIdx)]);
            }
            return tmp;
        }
    }

    let hyperParams: Set<ast.Name> = new Set();
    let importList: Set<string> = new Set(["torch", "torch.nn"]);

    function topoSort(): string[]{
        let srcEdgNum = new Map(Array.from(graph.entries()).filter(
            ([_, blkBody]) => !(blkBody.blockType == Block.literalNodeType)
        ).map(
            ([blkid, blkBody]) => [blkid, blkBody.nonLitSources().length])
        );
        let zeroSrcId = [...srcEdgNum.entries()].flatMap(([x, y]) => (y == 0 ? [x] : []));
        let ret: string[] = [];
        // console.log(srcEdgNum);
        while(zeroSrcId.length > 0){
            let id = zeroSrcId.pop()!;
            let blk = graph.get(id)!;
            ret.push(id);
            Array.from(blk.fTar.entries()).forEach(([_, edges]) => 
                edges.forEach(e => {
                    srcEdgNum.set(e.nodeID, (srcEdgNum.get(e.nodeID)!)-1);
                    if(srcEdgNum.get(e.nodeID) == 0)
                        zeroSrcId.push(e.nodeID);
                }
            ));
        }
        console.log("topo sorted", ret);
        return ret;
    }

    let topoSorted: string[] = topoSort();

    function topoEnumerate(
        work: (blkId: string) => void, 
        startFrom: string | undefined, 
        endingAt: string | undefined
    ): void {
        let stIdx = startFrom ? topoSorted.findIndex(x => x == startFrom) : 0;
        let edIdx = endingAt ? topoSorted.findIndex(x => x == endingAt) + 1 : undefined;
        console.log("topo enumerating through", stIdx, edIdx, topoSorted.slice(stIdx, edIdx));
        topoSorted.slice(stIdx, edIdx).forEach(x => work(x));
    }

    function genForwardDef(classEnv: MemberTracker): {code: ast.Def, inputOrder: string[]} {
        let varGenerator: VarNameGenerator = new VarNameGenerator();
        let inputs = Array.from(graph.inputBlock.fTar.keys()).map(key => [INPUTBLKID + "-" + key, ast.Name(varGenerator.genFlowVar())] as [string, ast.Name]);
        let edgeVarMap: Map<string, ast.Name> = new Map(inputs);
        
        let forwardBody: SyntaxNode[] = [];
        topoEnumerate(blkId => {
            let blk = graph.get(blkId);
            if(blk instanceof LayerBlock){
                console.log("gen forward on", blkId);
                if(!classEnv.memberVar.has(blkId))
                    classEnv.addAsMember(blkId, blk);
                let thisLayerVar = classEnv.memberVar.get(blkId)!;

                let fwdArgs: ast.Argument[] = [];
                Array.from(blk.fSrc.entries()).forEach(([edgKey, edgeEnd]) =>{
                    let splittedKey = edgKey.split("-");
                    if(splittedKey[0] != "fwd" || edgeEnd.length == 0)
                        return;
                    let paramName = splittedKey[1];
                    let args = edgeEnd.map(e => edgeVarMap.has(e.asIDKey()) ? edgeVarMap.get(e.asIDKey())! : classEnv.toValue(e));
                    let actualArg = (args.length > 1) ? ast.Argument(ast.Tuple(args), ast.Name(paramName)) : ast.Argument(args[0], ast.Name(paramName));
                    fwdArgs.push(actualArg);
                });
                let thisFlowVar = ast.Name(varGenerator.genFlowVar());
                forwardBody.push(
                    ast.Assignment("=", 
                    [thisFlowVar], 
                    [ast.Call(thisLayerVar, fwdArgs)]
                ));
                edgeVarMap.set(blkId + "-fwd-return", thisFlowVar);
            }
        }, INPUTBLKID, OUTPUTBLKID);
        let retVals = Array.from(graph.outputBlock.fSrc.entries()).map(([edgKey, edgeEnd]) =>{
            let splittedKey = edgKey.split("-");
            let paramName = splittedKey[1];
            let args = edgeEnd.map(e => edgeVarMap.has(e.asIDKey()) ? edgeVarMap.get(e.asIDKey())! : classEnv.toValue(e));
            let actualArg = (args.length > 1) ? ast.Tuple(args) : args[0];
            return [paramName, actualArg] as [string, SyntaxNode];
        });
        forwardBody.push(ast.Return(retVals.map(([_, retV]) => retV)));

        let funcDef = ast.Def("forward", [ast.Parameter("self"), ...inputs.map(([_, x]) => ast.Parameter(x.id))], forwardBody);
        return {code: funcDef, inputOrder: inputs.map(x => x[0])};
    }

    function genModelClass(): {code: ast.Class, inputOrder: string[]}{
        const modelClassEnv = new MemberTracker();
        const {code: forwardDef, inputOrder} = genForwardDef(modelClassEnv);
        const initDef = ast.Def("__init__", [ast.Parameter("self")], [
            ast.Call(ast.Dot(ast.Call(ast.Name("super"), []), "__init__"), []),
            ...modelClassEnv.initBody
        ]);
        const classDef = ast.Class(modelName + "_layers", [ast.Dot(ast.Dot(ast.Name("torch"), "nn"), "Module")], [
            initDef, 
            forwardDef
        ]);
        return {code: classDef, inputOrder};
    }
      
    function genTrainingClass(modelClass: ast.Class, optimType: string): ast.Class{
        function genStatements_TrainOptimDef(optimType: string, pythonCodes: ast.SyntaxNode[]): ast.Name{
            let astOptimizerVar = ast.Name("optimizer");
            let optimizerType = ast.Dot(ast.Dot(ast.Name("torch"), "nn"), optimType);     //torch.nn.Adam
            pythonCodes.push(ast.Assignment("=", [astOptimizerVar], [ast.Call(optimizerType, [])]));
            return astOptimizerVar;
        }
        let varGenerator = new VarNameGenerator();
        let loopBody: ast.SyntaxNode[] = [];
        let globalEnv = new MemberTracker();

        let edgeVarMap: Map<string, ast.Name> = new Map([[OUTPUTBLKID + "-fwd-return", ast.Name(varGenerator.genFlowVar())]]);
        let finalLossContri: ast.Name[] = [];
        let astLossVar = ast.Name("final_loss");
        function genStatements_TrainLossCal(){
            topoEnumerate(blkId => {
                let blk = graph.get(blkId)!;
                if(blk instanceof LiteralBlock)
                    return ;
                if(blk instanceof LayerBlock) {
                    console.log("gen lossCal on", blkId);
                    if(!globalEnv.memberVar.has(blkId))
                        globalEnv.addAsMember(blkId, blk);
                    let thisLayerVar = globalEnv.memberVar.get(blkId)!;
    
                    let fwdArgs: ast.Argument[] = [];
                    Array.from(blk.fSrc.entries()).forEach(([edgKey, edgeEnd]) =>{
                        let splittedKey = edgKey.split("-");
                        if(splittedKey[0] != "fwd" || edgeEnd.length == 0)
                            return;
                        let paramName = splittedKey[1];
                        let args = edgeEnd.map(e => edgeVarMap.has(e.asIDKey()) ? edgeVarMap.get(e.asIDKey())! : globalEnv.toValue(e));
                        let actualArg = (args.length > 1) ? ast.Argument(ast.Tuple(args), ast.Name(paramName)) : ast.Argument(args[0], ast.Name(paramName));
                        fwdArgs.push(actualArg);
                    });
                    let thisFlowVar = ast.Name(varGenerator.genFlowVar());
                    loopBody.push(
                        ast.Assignment("=", 
                        [thisFlowVar], 
                        [ast.Call(thisLayerVar, fwdArgs)]
                    ));
                    edgeVarMap.set(blkId + "-fwd-return", thisFlowVar);
                }
                if(Array.from(blk.fTar.values()).flatMap(x => x).length == 0)
                    finalLossContri.push(edgeVarMap.get(blkId + "-fwd-return")!);
            }, OUTPUTBLKID, undefined);
            if(finalLossContri.length >= 1){
                let [firstLoss, ...restLoss] = finalLossContri;
                let lossSum = restLoss.reduce((pv, nv) => ast.BinaryOperator("+", pv, nv), firstLoss as ast.SyntaxNode)
                loopBody.push(ast.Assignment("=", [astLossVar], [lossSum]));
            }
        }

        let astModelVar = ast.Name("model");
        let funcBody: ast.SyntaxNode[] = [];
        funcBody.push(
            ast.Assignment("=", 
            [astModelVar], 
            [ast.Call(
                ast.Name(modelClass.name), []
            )]
        ));
        loopBody.push(ast.Assignment("=", [edgeVarMap.get(OUTPUTBLKID + "-fwd-return")!], [ast.Call(astModelVar, [ast.Argument(ast.Name("data"))])]));
        
        let astOptimVar = genStatements_TrainOptimDef(optimType, funcBody);
        let makeForLoop = (code: ast.SyntaxNode[]) => ast.For([ast.Name("batch_idx"), ast.Name("data"), ast.Name("target")], [ast.Call(ast.Name("enumerate"), [ast.Argument(ast.Name("data_loader"))])], code);

        
        genStatements_TrainLossCal();
        loopBody.push(ast.Call(ast.Dot(astOptimVar, "zero_grad"), []));
        loopBody.push(ast.Call(ast.Dot(astLossVar, "backward"), []));
        loopBody.push(ast.Call(ast.Dot(astOptimVar, "step"), []));
        
        loopBody.push(ast.If(ast.BinaryOperator("==", ast.BinaryOperator("%", ast.Name("batch_idx"), ast.Literal(100)), ast.Literal(0)), 
            [ast.Call(ast.Name("print"), [])],
            [], ast.Else([])
        ));
        
        funcBody.push(makeForLoop(loopBody));
        return ast.Class(modelName + "_train", [], [
                ast.Def("__init__", [ast.Parameter("self")], [
                ...globalEnv.initBody
            ]),
            ast.Def("train", [ast.Parameter("self")], funcBody)
        ]);
    }

    let modelClassDef = genModelClass().code;
    let trainingDef = genTrainingClass(modelClassDef, "Adam");
    let imports = Array.from(importList.keys()).map(x => ast.Import([{path: x, location: ""}]));
    return ast.Module([...imports, modelClassDef, trainingDef]);
}