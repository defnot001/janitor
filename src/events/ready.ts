import { ActivityType } from 'discord.js';
import { Event } from '../handler/classes/Event';
import Logger from '../log/logger';
// import { client } from '../index';
// import { config } from '../config';

export default new Event('ready', async (c) => {
  c.user.setActivity('Bad Actors', { type: ActivityType.Watching });
  Logger.log(`Bot is ready! Logged in as ${c.user.username}.`, 'info');
  // await client.removeCommands();
});
