import { Router } from "express";
import { loginRoute } from "./loginRoute";
import { codeParseRoute } from "./codeParseRoute";
import { datasetsRouter } from "./datasetsRouter";
import { UDBRouter } from "./UDBRouter";

export const routes = Router();

routes.use(loginRoute);
routes.use(codeParseRoute);
routes.use(datasetsRouter);
routes.use(UDBRouter);
