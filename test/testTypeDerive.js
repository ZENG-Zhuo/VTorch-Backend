"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parsePythonObject_1 = require("../src/codeParse/parsePythonObject");
const pythonTypes_1 = require("../src/codeGen/pythonTypes");
function strToType(str) {
    return (0, pythonTypes_1.toPythonType)((0, parsePythonObject_1.parseTypeString)(str));
}
function doTest(base, ders, doUnzip, expected) {
    let baseType = (0, pythonTypes_1.toPythonType)((0, parsePythonObject_1.parseTypeString)(base));
    // console.log(baseType);
    let throwExcepction = () => {
        console.log("****************** Test failed ****************");
        console.log(base, ders, doUnzip);
        console.log(baseType);
        throw "Test failed";
    };
    for (let i = 0; i < ders.length; i++) {
        let tmp = (0, pythonTypes_1.deriveType)(baseType, ders[i], doUnzip);
        baseType = tmp.rest;
        // console.log(baseType);
    }
    if (typeof (baseType) == "undefined") {
        if (expected != "undefined")
            throwExcepction();
    }
    else {
        let checkNull = (0, pythonTypes_1.nullable)(baseType);
        // console.log(checkNull);
        if (String(checkNull) != expected) {
            throwExcepction();
        }
    }
}
// doTest("int", ["10"], false, "true");
// doTest("Tuple[int]", ["10"], true, "true");
// doTest("Tuple[int]", ["10"], false, "undefined");
// doTest("Tuple[int, int]", ["10"], true, "false");
// doTest("Tuple[int, int, ...]", ["10"], true, "false");
// doTest("Tuple[int, int, ...]", ["10", strToType("int")], true, "true");
// doTest("Tuple[int, int, ...]", ["10", strToType("int"), "11"], true, "true");
// doTest("_size_3_t", ["10"], false, "true");
// doTest("_size_3_t", ["10", "11"], false, "undefined");
// doTest("_size_3_t", ["10"], true, "false");
// doTest("_size_3_t", ["10", strToType("int")], true, "false");
// doTest("_size_3_t", ["10", strToType("int"), "11"], true, "true");
// doTest("_size_3_t", ["(10, 11, 12)"], false, "true");
// doTest("_size_3_t", ["(10, 11, 12)"], true, "undefined");
doTest("Boolean", ["True"], false, "true");
doTest("Boolean", ["true"], false, "true");
console.log("all test passed");
