import { Router } from "express";
import { UDBData, UDBInfo } from "../common/UDBTypes";
import { extractClassesAndFunctions } from "../codeParse/parsePythonObject";
import { randomUUID } from "crypto";

export const UDBRouter = Router();
const UDBMap: Map<string, UDBInfo> = new Map();

UDBRouter.post("/addUDB", async (req, res) => {
    try {
        const data = req.body as UDBData;
        const UDBinfo = new UDBInfo(data);
        const [classes, functions, _] = extractClassesAndFunctions(
            UDBinfo.data.code,
            "UDB"
        );
        let returnMsg = "";
        let error = false;
        classes.map((c) => {
            const initFunc = c.functions.find((f) => f.name === "__init__");
            if (initFunc) {
                initFunc.parameters.map((p, i) => {
                    if (i !== 0 && !p.type_hint) {
                        returnMsg = returnMsg.concat(
                            `Warning: class ${c.name}'s init function has no full type hint(parameter${p.name})!\n\r`
                        );
                    }
                });
            } else {
                returnMsg = returnMsg.concat(
                    `Error: class ${c.name} has no init function!\n\r`
                );
                error = true;
            }
            const forwardFunc = c.functions.find((f) => f.name === "forward");
            if (forwardFunc) {
                forwardFunc.parameters.map((p, i) => {
                    if (i !== 0 && !p.type_hint) {
                        returnMsg = returnMsg.concat(
                            `Warning: class ${c.name}'s forward function has no full type hint(parameter${p.name})!\n\r`
                        );
                    }
                });
                if (!forwardFunc.return_type) {
                    returnMsg = returnMsg.concat(
                        `Warning: class ${c.name}'s forward function has no return type hint!\n\r`
                    );
                }
            } else {
                returnMsg = returnMsg.concat(
                    `Error: class ${c.name} has no forward function!\n\r`
                );
                error = true;
            }
        });
        functions.map((f) => {
            f.parameters.map((p) => {
                if (!p.type_hint) {
                    returnMsg = returnMsg.concat(
                        `Warning: Function ${f.name} has no full type hint(parameter${p.name})!\n\r`
                    );
                }
            });
            if (!f.return_type) {
                returnMsg = returnMsg.concat(
                    `Warning: Function ${f.name} has no return type hint!\n\r`
                );
            }
        });
        if (error) {
            res.status(400).send(returnMsg);
        } else {
            UDBinfo.classes = classes;
            UDBinfo.functions = functions;
            UDBMap.set(UDBinfo.data.name, UDBinfo);
            res.send(returnMsg);
        }
    } catch (error) {
        res.status(400).send("Parse Error");
    }
});
