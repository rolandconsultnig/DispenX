import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { AppError } from "./errorHandler";
import { UserRole } from "@prisma/client";

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
  organizationId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(new AppError("Authentication required", 401));
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    return next(new AppError("Invalid or expired token", 401));
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("Authentication required", 401));
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return next(new AppError("Insufficient permissions", 403));
    }
    next();
  };
}
