/*jwt.ts*/
import jwt from "jsonwebtoken";

interface JwtPayload {
  id: string;
  email: string;
}

export const generateToken = (
  payload: JwtPayload,
  expiresIn: string = "7d"
): string => {
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn,
  } as any);
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(
    token,
    process.env.JWT_SECRET as string
  ) as JwtPayload;
};