import { Router } from "express";
import * as accountController from "../controllers/account.controller.js";
import { authenticate } from "../middleware/authenticate.js";

export const accountsRouter = Router();

accountsRouter.post("/auth/register", accountController.register);
accountsRouter.post("/auth/login", accountController.login);
accountsRouter.get("/users/me", authenticate, accountController.getMe);
accountsRouter.patch("/users/me", authenticate, accountController.updateMe);
accountsRouter.delete("/users/me", authenticate, accountController.deleteMe);
