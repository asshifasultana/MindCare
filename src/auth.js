import "dotenv/config";
import jwt from "jsonwebtoken";
import { prisma } from "./db.js";

export const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error(
    "JWT_SECRET must contain at least 32 characters."
  );
}

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

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      role: true,
    },
  });

  if (!user) {
    return res.status(401).json({
      message: "Account no longer exists.",
    });
  }

  req.user = user;
  next();
}