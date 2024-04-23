import { Router } from "express";
import { loginRoute } from "./loginRoute";
import { codeParseRoute } from "./codeParseRoute";
import { codeGenRouter } from "./codeGenRouter";
import { datasetsRouter } from "./datasetsRouter";
import { UDBRouter } from "./UDBRouter";
import { codeGenRouter } from "./codeGenRouter";

export const routes = Router();

routes.use(loginRoute);
routes.use(codeParseRoute);
routes.use(codeGenRouter);
routes.use(datasetsRouter);
routes.use(UDBRouter);
routes.use(codeGenRouter);
