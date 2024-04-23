"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parsePythonObject_1 = require("../src/codeParse/parsePythonObject");
const pythonTypes_1 = require("../src/codeGen/pythonTypes");
function doTest(srcType, tarType, expectedOut) {
    let typeSrc = (0, pythonTypes_1.toPythonType)((0, parsePythonObject_1.parseTypeString)(srcType));
    let typeTar = (0, pythonTypes_1.toPythonType)((0, parsePythonObject_1.parseTypeString)(tarType));
    let convertResult = (0, pythonTypes_1.isSubType)(typeSrc, typeTar);
    if (convertResult != expectedOut) {
        console.log("****************** Test failed ****************");
        console.log(srcType, tarType, expectedOut);
        console.log(typeSrc);
        console.log(typeTar);
        console.log(convertResult);
        throw "Test failed";
    }
}
doTest("int", "_bool", true);
doTest("_float", "_bool", true);
doTest("string", "_bool", false);
doTest("string", "string", true);
doTest("_float", "Union[_bool, str]", true);
doTest("str", "Union[_bool, str]", true);
doTest("str", "Union[_bool, _int]", false);
doTest("Union[_int, str]", "Union[_bool, str]", true);
doTest("List[Tensor]", "Union[Tuple[Tensor, ...], List[Tensor]]", true);
doTest("Tuple[Tensor, Tensor, Tensor]", "Union[Tuple[Tensor, ...], List[Tensor]]", true);
doTest("List[Tensor]", "Union[Tuple[Tensor, ...], None]", false);
doTest("Tuple[Tensor, ...]", "Union[Tuple[Tensor, ...], List[Tensor]]", true);
doTest("Tuple[Tensor, ...]", "Union[Tuple[Tensor], List[Tensor]]", false);
console.log("all tests passed");
