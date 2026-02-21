import { Hono } from "hono";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { WorkflowEntrypoint } from 'cloudflare:workers';
import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'
import { allowOrigins } from "@/common/config/origin";
import router from "@/router/router";
import { getGatewayManager, initGatewayManager } from "./lib/gatewayManager";
import { getOBSManager, initOBSManager } from "./lib/OBSManager";
import { getPrismaClient, initPrismaClient } from "./lib/prisma";
import { getKV, initKV } from "./lib/KV";
import { getEmailManager, initEmailManager } from "./lib/emailManager";

declare global {
	var servicesInitialized: boolean | undefined;
}

export type Bindings = {
	// Basic workflow binding
	CommonServerAPI: Workflow;

	// bindings
	DB: D1Database;
	KV: KVNamespace;
	OBS: R2Bucket;

	// environment variables
	API_KEY: string;
	PUBLIC_ACCESS_KEY: string;
	JWT_SECRET: string;
	RESEND_API_KEY: string;
};

async function initializeServices(env: Bindings) {
	console.log('🚀 Initializing services...');
	const startTime = Date.now();
	// init gateway Manager
	initGatewayManager();
	gatewayManager = getGatewayManager();

	// init database
	initPrismaClient(env);
	prisma = getPrismaClient();

	// init KV Namespace
	initKV(env);
	KV = getKV();

	// init OBS Manager
	initOBSManager(env);
	OBSManager = getOBSManager();
	const duration = Date.now() - startTime;

	// init Email Manager
	initEmailManager(env);
	EmailManager = getEmailManager();

	console.log(`✅ All services initialized successfully in ${duration}ms`);
}

export async function warmup(env: Bindings) {
	console.log('🔥 Warming up services...');
	await initializeServices(env);
	console.log('✅ Warmup completed');
}

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

app.use('*', async (c, next) => {
	if (!globalThis.servicesInitialized) {
		console.log('First request - initializing services...');
		await initializeServices(c.env);
		globalThis.servicesInitialized = true;
	}
	await next();
});

app.use('*',
	prettyJSON(),
	logger(),
	cors({
		origin: allowOrigins,
		allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		allowHeaders: ['Content-Type', 'Authorization'],
		credentials: true,
	}),
	async (c, next) => {
		if (c.req.method === 'POST' && c.req.path === '/user/logout') {
			await next();
			return
		}
		return csrf({
			origin: allowOrigins,
		})(c, next)
	}
)

app.route('/', router);

// Health check endpoint
app.get("/", async (c) => {
	return c.json({ message: "Common Server API is running." }, 200);
});

export default app;