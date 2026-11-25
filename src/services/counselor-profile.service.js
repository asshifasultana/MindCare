import { Prisma } from "@prisma/client";
import * as profileRepository from "../repositories/counselor-profile.repository.js";
import { HttpError } from "../utils/http-error.js";

export function requireCounselor(user, action) {
  if (user.role !== "COUNSELOR") {
    throw new HttpError(403, `Only counselors can ${action} profiles.`);
  }
}

export async function createProfile(userId, input) {
  try {
    return await profileRepository.createProfile(userId, input);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new HttpError(409, "This counselor already has a profile.");
    }
    throw error;
  }
}

export function listProfiles(search) {
  return profileRepository.listProfiles(search);
}

export async function getProfile(id) {
  const profile = await profileRepository.findProfileById(id);
  if (!profile) {
    throw new HttpError(404, "Counselor profile not found.");
  }
  return profile;
}

async function rejectUnmatchedProfile(id) {
  if (id && await profileRepository.findProfileIdentityById(id)) {
    throw new HttpError(403, "You can only modify your own counselor profile.");
  }
  throw new HttpError(404, "Counselor profile not found.");
}

export async function updateProfile(userId, id, input) {
  const profile = await profileRepository.updateOwnProfile(userId, id, input);
  if (!profile) {
    await rejectUnmatchedProfile(id);
  }
  return profile;
}

export async function deleteProfile(userId, id) {
  const count = await profileRepository.deleteOwnProfile(userId, id);
  if (count === 0) {
    await rejectUnmatchedProfile(id);
  }
}
