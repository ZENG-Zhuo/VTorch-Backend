"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parsePythonObject_1 = require("../src/codeParse/parsePythonObject");
const pythonTypes_1 = require("../src/codeGen/pythonTypes");
function doTest(typeString, textString, expectedOut) {
    let zzType = (0, parsePythonObject_1.parseTypeString)(typeString);
    let myType = (0, pythonTypes_1.toPythonType)(zzType);
    let convertResult = (0, pythonTypes_1.convertTo)(textString, myType);
    if (convertResult.succ != expectedOut) {
        console.log("****************** Test failed ****************");
        console.log(typeString, textString, expectedOut);
        console.log(zzType);
        console.log(myType);
        console.log(convertResult);
        throw "Test failed";
    }
}
doTest("int", "10", true);
doTest("int", "10.1", false);
doTest("_int", "10", true);
doTest("float", "0x10", true);
doTest("_float", "10", true);
doTest("_bool", "True", true);
doTest("bool", "False", true);
doTest("_bool", "true", true);
doTest("bool", "false", true);
doTest("Tuple[int, dtype]", "(10, float32)", true);
doTest("Tuple[int, int]", "(10, float32)", false);
doTest("List[int]", "[10, 32]", true);
doTest("List[Tuple[int, int]]", "[(10, 32), (10, 32), (10, 32)]", true);
doTest("Tensor", "Tensor([1,2,3,4])", true);
doTest("Tensor[int]", "Tensor([1,2,3,4])", true);
doTest("Union[Tensor, None]", "Tensor([1,2,3,4])", true);
doTest("Union[Tensor, None]", "None", true);
doTest("Optional[Tensor]", "Tensor([1,2])", true);
doTest("Optional[Tensor]", "None", true);
doTest("Tuple[Tensor, ...]", "(Tensor([1,2]), Tensor([1,2]), Tensor([1,2]))", true);
doTest("Tuple[Tensor, ...]", "[Tensor([1,2]), Tensor([1,2]), Tensor([1,2])]", false);
doTest("Union[Tuple[Tensor, ...], List[Tensor]]", "[Tensor([1,2]), Tensor([1,2]), Tensor([1,2])]", true);
doTest("Union[Tuple[Tensor, ...], List[Tensor]]", "(Tensor([1,2]), Tensor([1,2]), Tensor([1,2]))", true);
doTest("str", "'1', '2'", false);
doTest("str", "'1(((((2'", true);
doTest("Union[str, _size_2_t]", "''", true);
doTest("Union[str, _size_2_t]", "(0, 1)", true);
doTest("Union[str, _size_2_t]", "0", true);
doTest("Union[str, _size_2_t]", "(0, 1, 2)", false);
console.log("all tests passed");
