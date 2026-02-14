import { PrismaClient } from '@prisma/client';

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required in production');
}

const prisma = new PrismaClient({
  datasources: process.env.DATABASE_URL
    ? {
        db: {
          url: process.env.DATABASE_URL,
        },
      }
    : undefined,
});

export default prisma;
