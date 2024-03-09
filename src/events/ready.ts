import { ActivityType, TextChannel } from 'discord.js';
import { Event } from '../handler/classes/Event';
import { getTextChannelByID } from '../commands/adminconfig';
import { botConfig } from '../config';
import { LOGGER } from '..';
// import { client } from '../index';
// import { config } from '../config';

export let errorLog: TextChannel | null = null;

export default new Event('ready', async (c) => {
  c.user.setActivity('Bad Actors', { type: ActivityType.Watching });
  LOGGER.info(`Bot is ready! Logged in as ${c.user.username}.`);

  errorLog = await getTextChannelByID(c, botConfig.adminServerErrorLogChannel);
  LOGGER.info(`Error log channel set to ${errorLog?.name}!`);
  // await client.removeCommands();
});
