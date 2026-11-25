import { Router } from "express";
import { getMe, updateMe, deleteMe } from "../controllers/account.controller.js";
import { authenticate } from "../middleware/authenticate.js";

export const userRouter = Router();

userRouter.get("/me", authenticate, getMe);
userRouter.patch("/me", authenticate, updateMe);
userRouter.delete("/me", authenticate, deleteMe);
