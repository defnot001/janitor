import type { Guild } from 'discord.js';
import { botConfig } from '../config';
import { AdminModelController } from '../database/model/AdminModelController';
import { type DbUser, UserModelController } from '../database/model/UserModelController';
import type { ExtendedInteraction } from '../handler/types';
import { displayGuild, displayUser } from './discord';
import { LOGGER } from './logger';

/**
 * Checks if the user has permission to use the command by checking if the user exists in the users table in the database.
 * Returns the user and guild if the user exists in the database.
 * Only works with deferred replies.
 *
 * **Sideeffect**: Sends a reply and logs a warning if the user does not exist in the database.
 */
export async function checkUserInDatabase(options: {
	interaction: ExtendedInteraction;
	commandName: string;
}): Promise<{ dbUser: DbUser; guild: Guild } | null> {
	const { interaction, commandName } = options;
	const guild = await getInteractionGuild(interaction);

	if (!guild) {
		return null;
	}

	try {
		const dbUser = await UserModelController.getUser(interaction.user.id);

		if (!dbUser) {
			await LOGGER.warn(
				`User ${displayUser(interaction.user)} attempted to use /${commandName} in ${displayGuild(
					guild,
				)} but the user does not exist in the database.`,
			);
			await interaction.editReply('You do not have permission to use this command.');
			return null;
		}

		return { dbUser, guild };
	} catch (e) {
		await LOGGER.error(`Error fetching user: ${e}`);
		await interaction.editReply('Error fetching user.');
		return null;
	}
}

/**
 * Checks if the user has permission to use the command by checking if the user is an admin in the database.
 * Only works with deferred replies.
 *
 * **Sideeffect**: Sends a reply and logs a warning if the user is not an admin.
 */
export async function checkAdminInDatabase(options: {
	interaction: ExtendedInteraction;
	commandName: string;
}): Promise<boolean> {
	const { interaction, commandName } = options;
	const guild = await getInteractionGuild(interaction);

	if (!guild) {
		return false;
	}

	try {
		if (!(await AdminModelController.isAdmin(interaction.user.id))) {
			await LOGGER.warn(
				`${displayUser(interaction.user)} attempted to use /${commandName} in ${displayGuild(
					guild,
				)} without permission.`,
			);
			await interaction.editReply('You do not have permission to use this command.');
			return false;
		}
	} catch (e) {
		await LOGGER.error(`Error fetching admin: ${e}`);
		await interaction.editReply('Error fetching admin.');
		return false;
	}

	return true;
}

/**
 * Checks if the interaction was created in the admin server.
 * Only works with deferred replies.
 *
 * **Sideeffect**: Sends a reply and logs a warning if the interaction was not created in the admin server.
 */
export async function isInteractionInAdminServer(options: {
	interaction: ExtendedInteraction;
	commandName: string;
}): Promise<boolean> {
	const { interaction, commandName } = options;
	const guild = await getInteractionGuild(interaction);

	if (!guild) {
		return false;
	}

	if (guild.id !== botConfig.adminServerID) {
		await LOGGER.warn(
			`${displayUser(
				interaction.user,
			)} attempted to use /${commandName} outside of the admin server.`,
		);
		await interaction.editReply('This command can only be used in the admin server.');
		return false;
	}

	return true;
}

/**
 * Checks if the interaction was created in one of the User's allowed servers.
 * Only works with deferred replies.
 *
 * **Sideeffect**: Sends a reply and logs a warning if the interaction was not created in one of the User's allowed servers.
 */
export async function isInteractionInUsersAllowedServers(options: {
	interaction: ExtendedInteraction;
	commandName: string;
	dbUser: DbUser;
	guild: Guild;
}): Promise<boolean> {
	const { interaction, commandName, dbUser, guild } = options;

	if (!dbUser.servers.includes(guild.id)) {
		await LOGGER.warn(
			`${displayUser(
				interaction.user,
			)} attempted to use /${commandName} outside of their allowed server(s).`,
		);
		await interaction.editReply('This command can only be used your server(s).');
		return false;
	}

	return true;
}

/**
 * Checks if the command was used in a guild and returns the guild if it exists.
 *
 * **Sideeffect**: Sends a reply if the command was not used in a guild.
 */
async function getInteractionGuild(interaction: ExtendedInteraction): Promise<Guild | null> {
	if (!interaction.guild) {
		await interaction.editReply('This command can only be used in a server.');
		return null;
	}

	return interaction.guild;
}
