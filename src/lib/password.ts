import bcrypt from "bcryptjs";

/**
 * Password hashing. bcryptjs is pure-JS (no native build), which keeps CI and
 * the Next runtime simple. Cost 12 is a reasonable 2020s default.
 */
const BCRYPT_COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
