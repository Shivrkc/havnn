/*jwt.ts*/
import jwt from "jsonwebtoken";

interface JwtPayload {
  id: string;
  email: string;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error("FATAL: JWT_SECRET environment variable is not defined or is empty.");
  }
  return secret;
}

export const generateToken = (
  payload: JwtPayload,
  expiresIn: string = "7d"
): string => {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn,
  } as any);
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(
    token,
    getJwtSecret()
  ) as JwtPayload;
};