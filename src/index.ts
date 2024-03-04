import { GatewayIntentBits } from 'discord.js';
import { ExtendedClient } from './handler/classes/ExtendedClient';
import { projectPaths } from './config';
import { Client } from 'pg';
import Logger from './log/logger';

export const client = new ExtendedClient({
  intents: [GatewayIntentBits.GuildModeration],
});

await client.start({
  botToken: process.env.DISCORD_BOT_TOKEN,
  guildID: process.env.DISCORD_GUILD_ID,
  commandsPath: projectPaths.commands,
  eventsPath: projectPaths.events,
  globalCommands: true,
  registerCommands: true,
});

export const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
});

pgClient
  .connect()
  .then(() => Logger.log('Connected to the database.', 'info'))
  .catch((err) => Logger.log(err, 'error'));

process.on('SIGINT', () => {
  pgClient.connect();
  client.destroy();
  process.exit();
});
