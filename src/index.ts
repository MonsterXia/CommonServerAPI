import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { WorkflowEntrypoint } from 'cloudflare:workers';
import { PrismaClient } from './generated/prisma/';
import { PrismaD1 } from '@prisma/adapter-d1';

type Bindings = {
	// Basic workflow binding
	CommonServerAPI: Workflow;

	// bindings
	DB: D1Database;

	// environment variables
	API_KEY: string;
	PUBLIC_ACCESS_KEY: string;
};

export class CommonServerAPI extends WorkflowEntrypoint<Bindings> {
	async run(event: any, step: any) {
		// Define the workflow steps here
		console.log('Workflow started with event:', event);

		await step.do('initial step', async () => {
			console.log('Executing initial step');
			return { status: 'completed' };
		});
	}
}

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", prettyJSON(), logger(), async (c, next) => {
	const auth = bearerAuth({ token: c.env.PUBLIC_ACCESS_KEY });
	return auth(c, next);
});

app.get("/", async (c) => {
	return c.json({ message: "Common Server API is running." });
});

app.get("/admins", async (c) => {
	try {
		const adapter = new PrismaD1(c.env.DB);
    	const prisma = new PrismaClient({ adapter });
		const admins = await prisma.admin.findMany();
		// let { query, params } = await c.req.json();
		// let stmt = c.env.DB.prepare(query);
		// if (params) {
		// 	stmt = stmt.bind(...params);
		// }

		// const result = await stmt.run();
		return c.json(admins);
	} catch (err) {
		return c.json({ error: `Failed to run query: ${err}` }, 500);
	}
});

app.post("/api/exec", async (c) => {
	return c.text("/api/exec endpoint");
});

app.post("/api/batch", async (c) => {
	return c.text("/api/batch endpoint");
});

export default app;