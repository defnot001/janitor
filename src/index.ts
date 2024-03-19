import { GatewayIntentBits } from 'discord.js';
import { Client } from 'pg';
import { ExtendedClient } from './handler/classes/ExtendedClient';
import { LOGGER } from './util/logger';

export const client = new ExtendedClient({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildModeration],
});

await client.start({
	botToken: Bun.env.DISCORD_BOT_TOKEN,
	globalCommands: true,
	registerCommands: false,
});

export const pgClient = new Client({
	connectionString: Bun.env.DATABASE_URL,
});

pgClient
	.connect()
	.then(() => LOGGER.info('Connected to the database.'))
	.catch(async (e) => await LOGGER.error(e));

process.on('SIGINT', () => {
	pgClient.connect();
	client.destroy();
	process.exit();
});
