import path from 'node:path';
import { env } from 'bun';

const nodeEnv = Bun.env.NODE_ENV || 'development';
console.log(`Loaded ${nodeEnv} config.`);

export const botConfig = {
	botToken: env.DISCORD_BOT_TOKEN,
	clientID: env.DISCORD_CLIENT_ID,
	databaseURL: env.DATABASE_URL,
	adminServerID: env.ADMIN_SERVER_ID,
	adminServerLogChannel: env.ADMIN_SERVER_LOG_CHANNEL,
	adminServerErrorLogChannel: env.ADMIN_SERVER_ERROR_LOG_CHANNEL,
	superuser: env.SUPERUSER,
} as const;

function isConfigFullySet(config: { [key: string]: unknown }): boolean {
	for (const key in config) {
		const value = config[key];

		// Check if the value is an object and recurse, ignore null since typeof null === 'object' <- JS is the best language ever
		if (typeof value === 'object' && value !== null) {
			if (!isConfigFullySet(value as { [key: string]: unknown })) {
				return false;
			}
		} else {
			if (value === undefined) {
				console.error(`Missing value for key: ${key}`);
				return false;
			}
		}
	}
	return true;
}

if (!isConfigFullySet(botConfig)) {
	throw new Error('Config not fully set');
}

export type Config = typeof botConfig;

export const projectPaths = {
	sources: path.join(path.dirname(import.meta.dir), 'src'),
	commands: path.join(path.dirname(import.meta.dir), 'src/commands'),
	events: path.join(path.dirname(import.meta.dir), 'src/events'),
};
