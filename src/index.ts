import { GatewayIntentBits } from 'discord.js';
import { ExtendedClient } from './handler/classes/ExtendedClient';
import { projectPaths } from './config';
import { Client } from 'pg';
import { LOGGER } from './util/logger';

export const client = new ExtendedClient({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildModeration],
});

await client.start({
  botToken: process.env.DISCORD_BOT_TOKEN,
  commandsPath: projectPaths.commands,
  eventsPath: projectPaths.events,
  globalCommands: true,
  registerCommands: false,
});

export const pgClient = new Client({
  connectionString: process.env['DATABASE_URL'],
});

pgClient
  .connect()
  .then(() => LOGGER.info('Connected to the database.'))
  .catch(async (err) => await LOGGER.error(err.toString()));

process.on('SIGINT', () => {
  pgClient.connect();
  client.destroy();
  process.exit();
});
