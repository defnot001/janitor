import { ActivityType, TextChannel } from 'discord.js';
import { Event } from '../handler/classes/Event';
import Logger from '../util/logger';
import { getTextChannelByID } from '../commands/adminconfig';
import { botConfig } from '../config';
// import { client } from '../index';
// import { config } from '../config';

export let errorLog: TextChannel | null = null;

export default new Event('ready', async (c) => {
  c.user.setActivity('Bad Actors', { type: ActivityType.Watching });
  Logger.info(`Bot is ready! Logged in as ${c.user.username}.`);

  errorLog = await getTextChannelByID(c, botConfig.adminServerErrorLogChannel);
  Logger.info(`Error log channel set to ${errorLog?.name}!`);
  // await client.removeCommands();
});
