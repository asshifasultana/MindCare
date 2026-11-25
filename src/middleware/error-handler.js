import { z } from "zod";

export function notFound(req, res) {
  res.status(404).json({
    message: "Route not found.",
  });
}

// ---------- Central error handler ----------

// Express 5 forwards errors from async endpoints here.
export function errorHandler(error, req, res, next) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      message: "Invalid input.",
      errors: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  // Prisma unique-constraint error.
  if (error.code === "P2002") {
    return res.status(409).json({
      message: "An account with this email already exists.",
    });
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      message: "Invalid JSON.",
    });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      message: "Request body too large.",
    });
  }

  console.error(error);

  res.status(500).json({
    message: "Something went wrong.",
  });
}
