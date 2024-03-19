import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	type Client,
	type ComponentType,
	type Guild,
	type GuildMember,
	type Snowflake,
	TextChannel,
	type User,
} from 'discord.js';
import type { ExtendedInteraction } from '../handler/types';
import { LOGGER } from './logger';

/**
 * Fetches guilds from an array of guild IDs.
 * Returns a Map of guild IDs to guilds.
 */
export async function getGuildMap(
	guildIDs: Snowflake[],
	client: Client,
): Promise<Map<Snowflake, Guild | null>> {
	const serverMap: Map<Snowflake, Guild | null> = new Map();

	for (const guildID of guildIDs) {
		try {
			const guild = await client.guilds.fetch(guildID);
			serverMap.set(guildID, guild);
			LOGGER.debug(`Fetched guild with ID ${guildID}.`);
		} catch (e) {
			serverMap.set(guildID, null);
			await LOGGER.warn(`Guild with ID ${guildID} could not be fetched.`);
		}
	}

	return serverMap;
}

/**
 * Fetches users from an array of user IDs.
 * Returns a Map of user IDs to users or null if the user wasn't found.
 */
export async function getUserMap(
	userIDs: Snowflake[],
	client: Client,
): Promise<Map<Snowflake, User | null>> {
	const userMap: Map<Snowflake, User | null> = new Map();

	for (const userID of userIDs) {
		try {
			const user = await client.users.fetch(userID);
			userMap.set(userID, user);
			LOGGER.debug(`Fetched user with ID ${userID}.`);
		} catch {
			userMap.set(userID, null);
			await LOGGER.warn(`User with ID ${userID} was not found.`);
		}
	}

	return userMap;
}

export function getConfirmCancelRow() {
	const confirmButton = new ButtonBuilder({
		style: ButtonStyle.Success,
		label: 'Confirm',
		customId: 'confirm',
	});

	const cancelButton = new ButtonBuilder({
		style: ButtonStyle.Danger,
		label: 'Cancel',
		customId: 'cancel',
	});

	return new ActionRowBuilder<ButtonBuilder>({
		components: [confirmButton, cancelButton],
	});
}

export function getButtonCollector(interaction: ExtendedInteraction) {
	const { channel } = interaction;
	if (!channel) return;

	if (channel instanceof TextChannel) {
		return channel.createMessageComponentCollector<ComponentType.Button>({
			filter: (i) => i.user.id === interaction.user.id,
			max: 1,
			time: 10000,
		});
	}

	return;
}

/**
 * Fetches a GuildMember by their User ID.
 * Returns null if the user is not a member of the guild.
 */
export async function getGuildMember(options: {
	guild: Guild;
	user: User;
	client: Client;
}): Promise<GuildMember | null> {
	const { guild, user } = options;

	try {
		const guildMember = await guild.members.fetch(user.id);
		return guildMember;
	} catch {
		return null;
	}
}

/**
 * Fetches a TextChannel by its ID.
 * Returns null if the channel is not a valid text channel.
 *
 * @sideeffect Logs a warning if the channel is not a valid text channel. Logs an error if an error occurs while fetching the channel.
 */
export async function getTextChannelByID(
	client: Client,
	id: Snowflake,
): Promise<TextChannel | null> {
	try {
		const channel = await client.channels.fetch(id);

		if (channel?.isTextBased() && channel.type === ChannelType.GuildText) {
			return channel as TextChannel;
		}

		await LOGGER.warn(`Channel with ID ${id} is not a valid text channel.`);
		return null;
	} catch (e) {
		await LOGGER.error(e, `An error occurred while fetching channel with ID ${id}.`);
		return null;
	}
}
