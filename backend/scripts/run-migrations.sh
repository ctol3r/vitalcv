#!/usr/bin/env bash
set -e

# Apply Prisma migrations and generate the Prisma client
npx prisma migrate deploy
npx prisma generate
