import { Router } from "express";
import { CheckLogin, CreateUser, Login } from "../database/loginUtils";


export const loginRoute = Router();

loginRoute.post("/createUser", async (req, res, next) => {
    try {
        const answer = await CreateUser(
            req.body.username,
            req.body.password,
            req.body.email,
            req.body.name
        );
        res.send(answer);
    } catch (error) {
        return next(error);
    }
});

loginRoute.post("/login", async (req, res, next) => {
    try {
        const result = await Login(req.body.username, req.body.password);
        if (result.includes("-")) {
            res.cookie("username", req.body.username);
            res.cookie("session", result);
            res.send("Success");
        } else {
            res.status(401).send(result);
        }
    } catch (error) {
        return next(error);
    }
});

loginRoute.post("/testLogin", async (req, res, next) => {
    try {
        let result = await CheckLogin(
            req.cookies.username,
            req.cookies.session
        );
        if (result) res.send("OK");
        else res.status(403).send("Deny");
    } catch (error) {
        return next(error);
    }
});

