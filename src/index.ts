import { GatewayIntentBits } from 'discord.js';
import { ExtendedClient } from './handler/classes/ExtendedClient';
import { projectPaths } from './config';
import { Client } from 'pg';
import Logger from './util/logger';

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
  connectionString: process.env.DATABASE_URL,
});

pgClient
  .connect()
  .then(() => Logger.info('Connected to the database.'))
  .catch((err) => Logger.error(err.toString()));

process.on('SIGINT', () => {
  pgClient.connect();
  client.destroy();
  process.exit();
});
