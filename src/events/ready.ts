import { ActivityType, type Client, TextChannel } from 'discord.js';
import { Event } from '../handler/classes/Event';
import { LOGGER } from '../util/logger';
// import { client } from '../index';
// import { config } from '../config';

export default new Event('ready', async (c) => {
	c.user.setActivity('Bad Actors', { type: ActivityType.Watching });
	LOGGER.info(`Bot is ready! Logged in as ${c.user.username}.`);

	const errorLog = await getErrorLogChannel(c);
	await LOGGER.setLogChannel(errorLog);
	LOGGER.info(`Set error log channel to ${errorLog.name} in ${errorLog.guild.name}.`);

	// await client.removeCommands();
});

async function getErrorLogChannel(client: Client) {
	const channel = await client.channels.fetch(Bun.env.ADMIN_SERVER_ERROR_LOG_CHANNEL);

	if (!channel || !channel.isTextBased() || !(channel instanceof TextChannel)) {
		throw new Error('Error log channel not found.');
	}

	return channel;
}
