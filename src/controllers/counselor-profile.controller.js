import * as profileService from "../services/counselor-profile.service.js";
import {
  createProfileSchema,
  updateProfileSchema,
  directoryQuerySchema,
} from "../validation/counselor-profile.validation.js";

export async function createProfile(req, res) {
  profileService.requireCounselor(req.user, "create");
  const input = createProfileSchema.parse(req.body);
  const profile = await profileService.createProfile(req.user.id, input);
  res.status(201).json({ profile });
}

export async function listProfiles(req, res) {
  const input = directoryQuerySchema.parse(req.query);
  const profiles = await profileService.listProfiles(input.search);
  res.json({ profiles });
}

export async function getProfile(req, res) {
  const profile = await profileService.getProfile(req.params.id);
  res.json({ profile });
}

export async function updateProfile(req, res) {
  profileService.requireCounselor(req.user, "update");
  const input = updateProfileSchema.parse(req.body);
  const profile = await profileService.updateProfile(req.user.id, req.params.id, input);
  res.json({ profile });
}

export async function deleteProfile(req, res) {
  profileService.requireCounselor(req.user, "delete");
  await profileService.deleteProfile(req.user.id, req.params.id);
  res.status(204).end();
}
