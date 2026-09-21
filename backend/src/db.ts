import { PrismaClient } from '@prisma/client';

// Jeden klient na proces. `tsx watch` przeładowuje moduł przy każdej zmianie pliku,
// więc bez cache'u na globalThis dorobilibyśmy się dziesiątek połączeń do Postgresa.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
