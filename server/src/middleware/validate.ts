import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { AppError } from "./errorHandler";

export function validate(schema: ZodSchema, source: "body" | "query" | "params" = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req[source]);
      req[source] = data;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
        return next(new AppError(message, 400));
      }
      next(err);
    }
  };
}
