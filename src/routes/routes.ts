import { Router } from "express";
import { loginRoute } from "./loginRoute";
import { codeParseRoute } from "./codeParseRoute";

export const routes = Router();

routes.use(loginRoute);
routes.use(codeParseRoute);