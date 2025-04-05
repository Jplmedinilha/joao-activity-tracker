import dotenv from "dotenv";
dotenv.config();

export function verifyAuthHash(req, res, next) {
  const clientHash = req.headers["x-auth-hash"];
  const expectedHash = process.env.AUTH_HASH;

  if (!clientHash || clientHash !== expectedHash) {
    return res.status(403).json({ error: "Invalid or missing hash." });
  }

  next();
}
