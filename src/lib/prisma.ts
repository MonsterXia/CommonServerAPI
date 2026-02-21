import { PrismaClient } from '@/generated/prisma';
import { PrismaD1 } from '@prisma/adapter-d1'

declare global {
  var prisma: PrismaClient | undefined
}

export const initPrismaClient = (env: { DB: D1Database }) => {
  if (!global.prisma) {
    console.log('🗄️  Initializing Database...');
    const adapter = new PrismaD1(env.DB)
    global.prisma = new PrismaClient({ adapter })
  }
}

export const getPrismaClient = () => {
  if (!global.prisma) {
    throw new Error("PrismaClient is not initialized");
  }
  return global.prisma
}