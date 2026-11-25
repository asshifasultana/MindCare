import { Router } from "express";
import * as profileController from "../controllers/counselor-profile.controller.js";
import { authenticate } from "../middleware/authenticate.js";

export const counselorProfilesRouter = Router();
const ownProfilePaths = ["/me", "/:id"];

counselorProfilesRouter.post("/", authenticate, profileController.createProfile);
counselorProfilesRouter.get("/", profileController.listProfiles);
counselorProfilesRouter.get("/:id", profileController.getProfile);
counselorProfilesRouter.patch(ownProfilePaths, authenticate, profileController.updateProfile);
counselorProfilesRouter.delete(ownProfilePaths, authenticate, profileController.deleteProfile);
