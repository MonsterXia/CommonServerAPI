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

Create migration file
```bash
npx wrangler d1 migrations create common-server-db create_admin_table
```
Write migration file
```bash
# create
npx prisma migrate diff --from-empty --to-schema ./prisma/schema.prisma --script --output migrations/0001_create_admin_table.sql
# update
npx prisma migrate diff --from-schema ./prisma/differ/schema_old.prisma --to-schema ./prisma/differ/schema_new.prisma --script --output migrations/0002_create_user_table.sql
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

## Deprecated

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





### Standard API workflow

Request => router => controller => service ( => KV) (=> database)

#### Router

```typescript
// Default
import { Hono } from 'hono';
const somethingRouter1 = new Hono();

// If need to get this from bindings
import { createNewRouter } from '@/router/routerfactory';
const somethingRouter2 = createNewRouter();

// Mount other router
import somethingRouter0 from './something0';
somethingRouter2.route('something0', somethingRouter0);

// Mount methods .get/.put/.post/.delete
import somethingController0 from '@/controller/something0/somethingController0';
somethingRouter2.post('/method1', somethingController0.method1);

// If use middleware
import { authMiddleware } from '@/middleware/auth';
somethingRouter2.get('/method2', authMiddleware, somethingController0.method2);

// export router
export default somethingRouter2;
```

#### Controller

```typescript
import { 
    buildContextJson, 
    buildErrorContextJson, 
    bussinessStatusCode 
} from "@/util/hono";

class superAdminController {
    public static async publicMethod(c: Context) {
        try {
          	// params
          	// const input = await c.req.query();
          	// directly get value from param
          	// const somevalue = await c.req.param('key')
          	// body
            const input = await c.req.json();
          
          	// TODO: Input Parser, implement by service
            const parserResult = setAdminParser(input);
            if (!parserResult.success) {
                return buildContextJson(c, parserResult);
            }
            const formattedInput = parserResult.data!;
          	// TODO: Your service, implement by service
            const result = await setAdminService(c, formattedInput);
          
          	// return
            return buildContextJson(c, result);
        } catch (e) {
          	// Any uncatched error
            return buildErrorContextJson(
                c, 
                'Set User As Admin Failed', 
                e,
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
    }
}

// export
export default superAdminController;
```

#### Service

```typescript
import { Context } from "hono";
import { StandardServerResult } from "@/model/util/hono";
import { buildStandardServerResponse, bussinessStatusCode } from "@/util/hono";
// Structure defined by you
import { SetSuperAdminRequestPayload } from "@/model/user/superAdmin";

// Parser
export const setAdminParser = (data: any): StandardServerResult<SetSuperAdminRequestPayload | null> => {
    if (!data.username) {
        return buildStandardServerResponse(
            false,
            'Missing username',
            null,
            bussinessStatusCode.BAD_REQUEST
        );
    }
    return buildStandardServerResponse(
        true,
        'Parse request payload successfully',
        {
            username: data.username.toString()
        },
        bussinessStatusCode.OK
    );
}

// Service
export const setAdminService = async (c: Context, data: SetSuperAdminRequestPayload): Promise<StandardServerResult<null>> => {
    try {
        if (condition) {
          	// Failed 
            return buildStandardServerResponse(
                false,
                'Failed info',
                null,
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
        // Success
        return buildStandardServerResponse(
            true,
            'Success data',
            // your defined data here,
            bussinessStatusCode.OK
        );
    } catch (error) {
      	// Error
        return buildStandardServerResponse(
            false,
            'Error message',
            null,
            bussinessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
}
```



