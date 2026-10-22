import { Request, Response } from "express";

export const getHealth = (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "HAVN Backend",
    version: "1.0.0",
  });
};