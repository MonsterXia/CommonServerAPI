import { PrismaClient } from '../generated/prisma';
import { PrismaD1 } from '@prisma/adapter-d1'

declare global {
  var prisma: PrismaClient | undefined
}

export const getPrismaClient = (env: { DB: D1Database }) => {
  if (!global.prisma) {
    const adapter = new PrismaD1(env.DB)
    global.prisma = new PrismaClient({ adapter })
  }
  return global.prisma
}