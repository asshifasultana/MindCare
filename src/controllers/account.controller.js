import * as accountService from "../services/account.service.js";
import {
  registrationSchema,
  loginSchema,
  updateSchema,
} from "../validation/account.validation.js";

export async function register(req, res) {
  const input = registrationSchema.parse(req.body);
  const user = await accountService.registerAccount(input);
  res.status(201).json({ user });
}

export async function login(req, res) {
  const input = loginSchema.parse(req.body);
  const result = await accountService.loginAccount(input);
  res.json(result);
}

export async function getMe(req, res) {
  const user = await accountService.getAccount(req.user.id);
  res.json({ user });
}

export async function updateMe(req, res) {
  const input = updateSchema.parse(req.body);
  const user = await accountService.updateAccount(req.user.id, input);
  res.json({ user });
}

export async function deleteMe(req, res) {
  await accountService.deleteAccount(req.user.id);
  res.status(204).end();
}
