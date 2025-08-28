# Backend

## Database Seeding

Run the Prisma migrations and seed the database with sample data for development.

```bash
npm install
npx prisma db push
npm run seed
```

The seed script adds two example users, assigns them sample credentials, and creates jobs for each.
