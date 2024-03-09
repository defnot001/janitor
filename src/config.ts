import path from 'path';
import { env } from 'bun';
import { LOGGER } from '.';

const nodeEnv = process.env['NODE_ENV'] || 'development';
LOGGER.info(`Loaded ${nodeEnv} config.`);

export const botConfig = {
  botToken: env['DISCORD_BOT_TOKEN'],
  clientID: env['DISCORD_CLIENT_ID'],
  databaseURL: env['DATABASE_URL'],
  superuser: env['SUPERUSER'],
  adminServerID: env['ADMIN_SERVER_ID'],
  adminServerLogChannel: env['ADMIN_SERVER_LOG_CHANNEL'],
  adminServerErrorLogChannel: env['ADMIN_SERVER_ERROR_LOG_CHANNEL'],
} as const;

function isConfigFullySet(config: { [key: string]: any }): boolean {
  for (const key in config) {
    const value = config[key];

    // Check if the value is an object and recurse, ignore null since typeof null === 'object' <- JS is the best language ever
    if (typeof value === 'object' && value !== null) {
      if (!isConfigFullySet(value)) {
        return false;
      }
    } else {
      if (value === undefined) {
        console.log(`Missing value for key: ${key}`);
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
  commands: path.join(path.dirname(import.meta.dir), `src/commands`),
  events: path.join(path.dirname(import.meta.dir), `src/events`),
};
