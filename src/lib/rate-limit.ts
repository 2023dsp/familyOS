import { prisma } from "./prisma";

const WINDOW_MIN = 15;
const MAX_FAILS = 8;

export async function recordLoginAttempt(ip: string, ok: boolean) {
  await prisma.loginAttempt.create({ data: { ip, ok } });
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch(() => {});
}

export async function isLoginBlocked(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MIN * 60 * 1000);
  const fails = await prisma.loginAttempt.count({
    where: { ip, ok: false, createdAt: { gte: since } }
  });
  return fails >= MAX_FAILS;
}
