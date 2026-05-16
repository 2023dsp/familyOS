import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPasswordV2(plain: string): Promise<string> {
  if (!plain || plain.length < 8) throw new Error("Password must be at least 8 characters.");
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPasswordV2(plain: string, hash: string): Promise<boolean> {
  if (!plain || !hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
