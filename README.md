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

### local

```bash
npx wrangler d1 execute common-server-db --file=./schemas/schema.sql
```

### remote

```bash
npx wrangler d1 execute common-server-db --file=./schemas/schema.sql --remote
```

## Tips
Remember to rerun 'npx wrangler types' after you change your 'wrangler.jsonc'/'.env*' file.
