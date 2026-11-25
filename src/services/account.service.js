import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { jwtSecret } from "../config/auth.js";
import * as userRepository from "../repositories/user.repository.js";
import { HttpError } from "../utils/http-error.js";

export async function registerAccount(input) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  return userRepository.createUser({
    name: input.name,
    email: input.email,
    passwordHash,
    role: input.role,
  });
}

export async function loginAccount(input) {
  const user = await userRepository.findUserByEmail(input.email);
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new HttpError(401, "Invalid email or password.");
  }

  const token = jwt.sign({}, jwtSecret, {
    algorithm: "HS256",
    subject: user.id,
    expiresIn: "1h",
  });

  return { token, tokenType: "Bearer", expiresIn: 3600 };
}

export function getAccount(id) {
  return userRepository.findPublicUserById(id);
}

export async function updateAccount(id, input) {
  const changes = {};
  if (input.name !== undefined) {
    changes.name = input.name;
  }
  if (input.password !== undefined) {
    changes.passwordHash = await bcrypt.hash(input.password, 10);
  }
  return userRepository.updateUser(id, changes);
}

export function deleteAccount(id) {
  return userRepository.deleteUser(id);
}
