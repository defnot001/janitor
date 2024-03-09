import {
  ApplicationCommandOptionType,
  Client,
  Guild,
  Snowflake,
  User,
  escapeMarkdown,
  inlineCode,
  time,
} from 'discord.js';
import { Command } from '../handler/classes/Command';
import { botConfig } from '../config';
import Logger from '../util/logger';
import { AdminModelController } from '../database/model/AdminModelController';
import { UserModelController } from '../database/model/UserModelController';
import { InfoEmbedBuilder } from '../util/builders';
import { getServerMap, getUserMap } from '../util/discord';
import { ServerConfigModelController } from '../database/model/ServerConfigModelController';

export default new Command({
  name: 'user',
  description: 'Subcommands for managing users.',
  options: [
    {
      name: 'add',
      description: 'Add a user to the whitelist.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description: 'The user to add to the whitelist.',
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: 'server_id',
          description:
            'Server(s) for bot usage, separated by commas. Admin server always included.',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: 'list',
      description: 'List all users on the whitelist.',
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: 'info',
      description: 'Get information about a user on the whitelist.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description: 'The user to get information about.',
          type: ApplicationCommandOptionType.User,
          required: true,
        },
      ],
    },
    {
      name: 'list_by_server',
      description: 'List all users on the whitelist for a specific server.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'server_id',
          description: 'The server to get users for.',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: 'update',
      description: 'Update a user on the whitelist.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description: 'The user to update.',
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: 'server_id',
          description:
            'Server(s) for bot usage, separated by commas. Admin server always included.',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: 'remove',
      description: 'Remove a user from the whitelist.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description: 'The user to remove from the whitelist.',
          type: ApplicationCommandOptionType.User,
          required: true,
        },
      ],
    },
  ],
  execute: async ({ interaction, args, client }) => {
    await interaction.deferReply();

    try {
      if (!(await AdminModelController.isAdmin(interaction.user.id))) {
        await interaction.editReply('You do not have permission to use this command.');
        await Logger.warn(
          `${interaction.user.globalName ?? interaction.user.username} attempted to use /user without permission.`,
        );
        return;
      }
    } catch (e) {
      await interaction.editReply("An error occurred while trying to get the bot's admins.");
      await Logger.error(`Error getting admins from the database: ${e}`);
      return;
    }

    if (!interaction.guild || interaction.guild.id !== botConfig.adminServerID) {
      await interaction.editReply('This command can only be used in the admin server.');
      await Logger.warn(
        `User ${interaction.user.id} tried to use /user in ${interaction.guild?.name} but it can only be used in the admin server.`,
      );
      return;
    }

    const subcommand = args.getSubcommand() as
      | 'list'
      | 'list_by_server'
      | 'info'
      | 'add'
      | 'update'
      | 'remove';

    if (subcommand === 'list') {
      try {
        const users = await UserModelController.getAllUsers();
        const uniqueServerIDs = await UserModelController.getUniqueServerIDs();

        if (users.length === 0) {
          await interaction.editReply('No users found.');
          return;
        }

        const serverMap = await getServerMap(uniqueServerIDs, client);
        const userMap = await getUserMap(
          users.map((user) => user.id),
          client,
        );

        const userEntries = users.map((user) => {
          const serverNames = user.servers.map((serverID) => serverMap.get(serverID));
          return `${userMap.get(user.id)} (${inlineCode(user.id)}):\n${serverNames.join(', ')}`;
        });

        const listEmbed = new InfoEmbedBuilder(interaction.user, {
          title: 'Whitelisted Users',
          description: userEntries.join('\n\n'),
        });

        await interaction.editReply({ embeds: [listEmbed] });
      } catch (e) {
        await Logger.error(`Error getting all users: ${e}`);
        await interaction.editReply('An error occurred while getting all users.');
        return;
      }

      return;
    }

    if (subcommand === 'list_by_server') {
      const serverID = args.getString('server_id', true);
      let server;

      try {
        server = await client.guilds.fetch(serverID);
      } catch (e) {
        await Logger.error(`Error fetching server: ${e}`);
        await interaction.editReply('An error occurred while fetching the server.');
        return;
      }

      if (!server) {
        await interaction.editReply('Server not found.');
        return;
      }

      try {
        const users = await UserModelController.getUsersByServer(serverID);

        if (users.length === 0) {
          await interaction.editReply('No users found.');
          return;
        }

        const userMap = await getUserMap(
          users.map((user) => user.id),
          client,
        );

        const userEntries = users.map((user) => `${userMap.get(user.id)} (${inlineCode(user.id)})`);

        const listEmbed = new InfoEmbedBuilder(interaction.user, {
          title: `Whitelisted Users for ${server.name}`,
          description: userEntries.join('\n'),
        });

        await interaction.editReply({ embeds: [listEmbed] });
      } catch (e) {
        await Logger.error(`Error getting users by server: ${e}`);
        await interaction.editReply('An error occurred while getting users by server.');
        return;
      }

      return;
    }

    const user = args.getUser('user');

    if (!user) {
      await interaction.editReply('User not found.');
      return;
    }

    if (subcommand === 'info') {
      try {
        const dbUser = await UserModelController.getUser(user.id);

        if (!dbUser) {
          await interaction.editReply(
            `User ${escapeMarkdown(user.globalName ?? user.username)} with ID ${inlineCode(user.id)} is not on the whitelist.`,
          );
          return;
        }

        const guilds = await fetchGuilds(dbUser.servers, client);

        if (hasFailedGuildFetches(guilds)) {
          const failedFetches = getFailedGuildFetches(guilds);
          await interaction.editReply(
            `Failed to fetch the following servers: ${failedFetches.map((id) => inlineCode(id)).join(', ')}. Either the bot is not in these servers or the IDs are incorrect.`,
          );
          return;
        }

        const checkedGuilds = Array.from(guilds.values()) as Guild[];

        const serverNames = checkedGuilds.map((g) => g.name);

        const infoEmbed = new InfoEmbedBuilder(interaction.user, {
          title: `User Info for ${escapeMarkdown(user.globalName ?? user.username)}`,
          fields: [
            {
              name: 'ID',
              value: inlineCode(dbUser.id),
            },
            {
              name: 'Servers',
              value: serverNames.join(', '),
            },
            {
              name: 'Created At',
              value: `${time(dbUser.created_at, 'D')}\n(${time(dbUser.created_at, 'R')})`,
            },
          ],
        });

        await interaction.editReply({ embeds: [infoEmbed] });
      } catch (e) {
        await Logger.error(`Error getting user information: ${e}`);
        await interaction.editReply('An error occurred while getting user information.');
        return;
      }
    }

    if (subcommand === 'add') {
      const serverIDs = args
        .getString('server_id', true)
        .split(',')
        .map((id) => id.trim());

      if (serverIDs.length === 0) {
        await interaction.editReply('No server IDs provided.');
        return;
      }

      try {
        const guilds = await fetchGuilds(serverIDs, client);

        if (hasFailedGuildFetches(guilds)) {
          const failedFetches = getFailedGuildFetches(guilds);
          await interaction.editReply(
            `Failed to fetch the following servers: ${failedFetches.map((id) => inlineCode(id)).join(', ')}. Either the bot is not in these servers or the IDs are incorrect.`,
          );
          return;
        }

        const checkedGuilds = Array.from(guilds.values()) as Guild[];

        const dbUser = await UserModelController.createUser({ id: user.id, servers: serverIDs });
        const serverNames = checkedGuilds.map((g) => g.name);

        await interaction.editReply(
          `Added User ${escapeMarkdown(user.globalName ?? user.username)} with ID ${inlineCode(dbUser.id)} to whitelist.\nThey are allowed to use the bot in the following servers: ${serverNames.join(', ')}`,
        );

        for await (const guild of checkedGuilds) {
          const created = await ServerConfigModelController.createServerConfigIfNotExists(guild.id);

          if (created) {
            Logger.info(`Created empty server config for server ${guild.name} (${guild.id})`);
            await interaction.followUp(
              `Created empty server config for server ${escapeMarkdown(guild.name)} (${inlineCode(guild.id)})`,
            );
          } else {
            Logger.debug(
              `Server config already exists for server ${guild.name} (${guild.id}). Skipping creation.`,
            );
          }
        }
      } catch (e) {
        await Logger.error(`Error adding user to whitelist: ${e}`);
        await interaction.editReply('An error occurred while adding the user to the whitelist.');
        return;
      }
    }

    if (subcommand === 'update') {
      const newServerIDs = args
        .getString('server_id', true)
        .split(',')
        .map((id) => id.trim());

      if (newServerIDs.length === 0) {
        await interaction.editReply('No server IDs provided.');
        return;
      }

      try {
        const newGuilds = await fetchGuilds(newServerIDs, client);

        if (hasFailedGuildFetches(newGuilds)) {
          const failedFetches = getFailedGuildFetches(newGuilds);
          await interaction.editReply(
            `Failed to fetch the following servers: ${failedFetches.map((id) => inlineCode(id)).join(', ')}`,
          );
          return;
        }

        const checkedNewGuilds = Array.from(newGuilds.values()) as Guild[];
        const newServerNames = checkedNewGuilds.map((g) => g.name);

        await UserModelController.updateUser({ id: user.id, servers: newServerIDs });

        await interaction.editReply(
          `Updated User ${escapeMarkdown(user.globalName ?? user.username)} with ID ${inlineCode(user.id)} on whitelist.\nThey are allowed to use the bot in the following servers: ${newServerNames.join(', ')}`,
        );
      } catch (e) {
        await Logger.error(`Error updating user on whitelist: ${e}`);
        await interaction.editReply('An error occurred while updating the user on the whitelist.');
        return;
      }

      try {
        await handleServerConfigUpdates(user, newServerIDs);
      } catch (e) {
        await Logger.error(`Error updating server configs: ${e}`);
        await interaction.followUp('An error occurred while updating server configs.');
        return;
      }
    }

    if (subcommand === 'remove') {
      try {
        const dbUser = await UserModelController.deleteUser(user.id);

        await interaction.editReply(
          `Removed User ${escapeMarkdown(user.globalName ?? user.username)} with ID ${inlineCode(dbUser.id)} from whitelist.`,
        );

        if (dbUser.servers.length === 0) {
          return;
        }

        const guilds = await fetchGuilds(dbUser.servers, client);

        if (hasFailedGuildFetches(guilds)) {
          const failedFetches = getFailedGuildFetches(guilds);
          await interaction.followUp(
            `Failed to fetch the following servers: ${failedFetches.map((id) => inlineCode(id)).join(', ')}`,
          );
          return;
        }

        const checkedGuilds = Array.from(guilds.values()) as Guild[];

        for await (const guild of checkedGuilds) {
          const deleted = await ServerConfigModelController.deleteServerConfigIfNeeded(guild.id);

          if (deleted) {
            Logger.info(
              `Deleted server config for server ${guild.name} (${guild.id}) because it's no longer in use.`,
            );
            await interaction.followUp(
              `Deleted server config for server ${escapeMarkdown(guild.name)} (${inlineCode(guild.id)}) because it's no longer in use.`,
            );
          } else {
            Logger.debug(
              `Server config for server ${guild.name} (${guild.id}) still in use. Skipping deletion.`,
            );
          }
        }
      } catch (e) {
        await Logger.error(`Error removing user from whitelist: ${e}`);
        await interaction.editReply(
          'An error occurred while removing the user from the whitelist.',
        );
        return;
      }
    }
  },
});

async function fetchGuilds(
  ids: Snowflake[],
  client: Client,
): Promise<Map<Snowflake, Guild | null>> {
  Logger.debug(`Fetching guilds: ${ids.join(', ')}`);

  const guildMap = new Map<Snowflake, Guild | null>();

  for await (const id of ids) {
    const guild = await client.guilds.fetch(id).catch(async () => {
      await Logger.warn(`Failed to fetch guild ${id}`);
      return null;
    });
    guildMap.set(id, guild);
  }

  return guildMap;
}

function hasFailedGuildFetches(guildMap: Map<Snowflake, Guild | null>): boolean {
  for (const guild of guildMap.values()) {
    if (!guild) {
      return true;
    }
  }

  return false;
}

function getFailedGuildFetches(guildMap: Map<Snowflake, Guild | null>): Snowflake[] {
  const failedFetches = [];

  for (const [id, guild] of guildMap) {
    if (!guild) {
      failedFetches.push(id);
    }
  }

  return failedFetches;
}

async function handleServerConfigUpdates(user: User, newServerIDs: Snowflake[]) {
  const currentUserData = await UserModelController.getUser(user.id);
  if (!currentUserData) {
    throw new Error(`User ${user.id} not found.`);
  }

  const { servers: oldServerIDs } = currentUserData;
  const serversToAdd = newServerIDs.filter((id) => !oldServerIDs.includes(id));
  const serversToRemove = oldServerIDs.filter((id) => !newServerIDs.includes(id));

  await Promise.all(
    serversToAdd.map((serverID) =>
      ServerConfigModelController.createServerConfigIfNotExists(serverID),
    ),
  );

  await Promise.all(
    serversToRemove.map((serverID) =>
      ServerConfigModelController.deleteServerConfigIfNeeded(serverID),
    ),
  );
}
