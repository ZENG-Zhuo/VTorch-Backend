import { parseTypeString } from "../src/codeParse/parsePythonObject";
import { toPythonType, convertTo } from "../src/codeGen/pythonTypes";

function doTest(typeString: string, textString: string, expectedOut: boolean) {
	let zzType = parseTypeString(typeString);
	let myType = toPythonType(zzType);
	let convertResult = convertTo(textString, myType);
	if (convertResult.succ != expectedOut){
		console.log("****************** Test failed ****************");
		console.log(typeString, textString, expectedOut);
		console.log(zzType);
		console.log(myType);
		console.log(convertResult);
		throw "Test failed"!
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

doTest("Optional[Sequence[Union[str, ellipsis, None]]]", "...", false)
doTest("Union[str, ellipsis, None]", "...", false)
doTest("Optional[Sequence[Union[str, ellipsis, None]]]", "['a', 'b', 'c']", true)
doTest("Union[str, ellipsis, None]", "'a'", true)

doTest("Optional[Union[_int, _size]]", "1", true);
doTest("Optional[Union[_int, _size]]", "(1,2,3)", true);
doTest("Optional[Union[_int, _size]]", "[1,2,3]", true);
doTest("Optional[Union[_int, _size]]", "[1,2,(3,)]", false);

console.log("all tests passed");