import { parseTypeString } from "../src/codeParse/parsePythonObject";
import { toPythonType, isSubType } from "../src/codeGen/pythonTypes";

function doTest(srcType: string, tarType: string, expectedOut: boolean) {
	let typeSrc = toPythonType(parseTypeString(srcType));
	let typeTar = toPythonType(parseTypeString(tarType));
	let convertResult = isSubType(typeSrc, typeTar);
	if (convertResult != expectedOut){
		console.log("****************** Test failed ****************");
		console.log(srcType, tarType, expectedOut);
		console.log(typeSrc);
		console.log(typeTar);
		console.log(convertResult);
		throw "Test failed"!
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

doTest("Any", "Any", true);


console.log("all tests passed");