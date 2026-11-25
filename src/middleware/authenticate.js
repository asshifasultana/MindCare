import jwt from "jsonwebtoken";
import { jwtSecret } from "../config/auth.js";
import { findAuthenticatedUserById } from "../repositories/user.repository.js";

export async function authenticate(req, res, next) {
  const authorization = req.get("authorization") ?? "";
  const match = /^Bearer ([^\s]+)$/i.exec(authorization);

  if (!match) {
    return res.status(401).json({
      message: "Login required.",
    });
  }

  let payload;

  try {
    payload = jwt.verify(match[1], jwtSecret, {
      algorithms: ["HS256"],
    });
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }

  if (
    typeof payload !== "object" ||
    typeof payload.sub !== "string"
  ) {
    return res.status(401).json({
      message: "Invalid token.",
    });
  }

  const user = await findAuthenticatedUserById(payload.sub);

  if (!user) {
    return res.status(401).json({
      message: "Account no longer exists.",
    });
  }

  req.user = user;
  next();
}
