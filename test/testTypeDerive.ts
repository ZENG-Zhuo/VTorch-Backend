import { parseTypeString } from "../src/codeParse/parsePythonObject";
import { toPythonType, deriveType, PythonType, nullable } from "../src/codeGen/pythonTypes";

function strToType(str: string): PythonType{
	return toPythonType(parseTypeString(str));
}

function doTest(base: string, ders: (string | PythonType)[], expected: string){
	let baseType: PythonType | undefined = toPythonType(parseTypeString(base));
	// console.log(baseType);
	let throwExcepction = () => {
		console.log("****************** Test failed ****************");
		console.log(base, ders);
		console.log(baseType);
		throw "Test failed"!
	}
	for(let i = 0;i < ders.length;i ++){
		let tmp = deriveType(baseType, ders[i]);
		baseType = tmp.rest;
		// console.log(baseType);
	}
	if(typeof(baseType) == "undefined"){
		if(expected != "undefined")
			throwExcepction();
	}
	else{
		let checkNull = nullable(baseType);
		// console.log(checkNull);
		if(String(checkNull) != expected){
			throwExcepction();
		}
	}
}

doTest("int", ["10"], "undefined");
doTest("Tuple[int]", ["10"], "true");
doTest("Tuple[int, int]", ["10"], "false");
doTest("Tuple[int, int, ...]", ["10"], "false");
doTest("Tuple[int, int, ...]", ["10", strToType("int")], "true");
doTest("Tuple[int, int, ...]", ["10", strToType("int"), "11"], "true");

doTest("_size_3_t", ["10"], "false");
doTest("_size_3_t", ["10", "11"], "false");
doTest("_size_3_t", ["10", strToType("int")], "false");
doTest("_size_3_t", ["10", strToType("int"), "11"], "true");
doTest("_size_3_t", ["(10, 11, 12)"], "undefined");

doTest("Tuple[Boolean]", ["True"], "true");
doTest("Tuple[Boolean]", ["true"], "true");

console.log("all test passed");