import { Router } from "express";
import { loginRoute } from "./loginRoute";
import { codeParseRoute } from "./codeParseRoute";
import { codeGenRouter } from "./codeGenRouter";

export const routes = Router();

routes.use(loginRoute);
routes.use(codeParseRoute);
routes.use(codeGenRouter);