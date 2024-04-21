import { Router } from "express";
import { loginRoute } from "./loginRoute";
import { codeParseRoute } from "./codeParseRoute";
import { datasetsRouter } from "./datasetsRouter";

export const routes = Router();

routes.use(loginRoute);
routes.use(codeParseRoute);
routes.use(datasetsRouter);
