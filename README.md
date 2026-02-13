# CommonServerAPI
Server hold at api.246801357.xyz

## Run/Deployment

### Run

```bash
npm run dev
```

### Deployment
```bash
npm run deploy
```

## Set Local Variables
```bash
npx wrangler secret put key
```

## Create/Update D1 databese 

### Prisma

npx prisma migrate diff --from-empty --to-schema ./prisma/schema.prisma --script --output migrations/0001_create_admin_table.sql


### Deprecated

Create migration file
```bash
npx wrangler d1 migrations create common-server-db create_admin_table
```
Write migration file
```bash
npx prisma migrate diff --from-empty --to-schema ./prisma/schema.prisma --script --output migrations/0001_create_admin_table.sql
```
Apply migration
```bash
npx wrangler d1 migrations apply common-server-db --local
npx wrangler d1 migrations apply common-server-db --remote
```

Generate prisma client
```bash
npx prisma generate
```

#### local

```bash
npx wrangler d1 execute common-server-db --file=./schemas/schema.sql
```

#### remote

```bash
npx wrangler d1 execute common-server-db --file=./schemas/schema.sql --remote
```

## Tips
Remember to rerun 'npx wrangler types' after you change your 'wrangler.jsonc'/'.env*' file.
