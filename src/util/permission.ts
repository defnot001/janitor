import { Guild } from 'discord.js';
import { AdminModelController } from '../database/model/AdminModelController';
import { UserModelController } from '../database/model/UserModelController';
import { ExtendedInteraction } from '../handler/types';
import { LOGGER } from './logger';
import { displayGuild, displayUser } from './discord';
import { botConfig } from '../config';

/**
 * Checks if the user has permission to use the command by checking if the user exists in the users table in the database.
 * Only works with deferred replies.
 */
export async function hasUserPermission(options: {
  interaction: ExtendedInteraction;
  commandName: string;
}): Promise<boolean> {
  const { interaction, commandName } = options;
  const guild = await getInteractionGuild(interaction);

  if (!guild) {
    return false;
  }

  try {
    const dbUser = await UserModelController.getUser(interaction.user.id);

    if (!dbUser) {
      await LOGGER.warn(
        `User ${displayUser(interaction.user)} attempted to use /${commandName} in ${displayGuild(guild)} but the user does not exist in the database.`,
      );
      await interaction.editReply('You do not have permission to use this command.');
      return false;
    }

    return true;
  } catch (e) {
    await LOGGER.error(`Error fetching user: ${e}`);
    await interaction.editReply('Error fetching user.');
    return false;
  }
}

/**
 * Checks if the user has permission to use the command by checking if the user is an admin in the database.
 * Only works with deferred replies.
 */
export async function hasAdminPermissions(options: {
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
        `${displayUser(interaction.user)} attempted to use /${commandName} in ${displayGuild(guild)} without permission.`,
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
      `${displayUser(interaction.user)} attempted to use /${commandName} outside of the admin server.`,
    );
    await interaction.editReply('This command can only be used in the admin server.');
    return false;
  }

  return true;
}

/**
 * Checks if the command was used in a server and returns the guild if it exists.
 */
export async function getInteractionGuild(interaction: ExtendedInteraction): Promise<Guild | null> {
  if (!interaction.guild) {
    await interaction.editReply('This command can only be used in a server.');
    return null;
  }

  return interaction.guild;
}
