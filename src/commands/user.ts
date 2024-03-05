import {
  ApplicationCommandOptionType,
  Client,
  Guild,
  Snowflake,
  escapeMarkdown,
  inlineCode,
  time,
} from 'discord.js';
import { Command } from '../handler/classes/Command';
import { config } from '../config';
import Logger from '../log/logger';
import { AdminModelController } from '../database/model/AdminModelController';
import { UserModelController } from '../database/model/UserModelController';
import { InfoEmbedBuilder } from '../builders';
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
        return;
      }
    } catch (e) {
      Logger.error(`Error getting admins: ${e}`);
      await interaction.editReply("An error occurred while trying to get the bot's admins.");
      return;
    }

    if (!interaction.guild || interaction.guild.id !== config.adminServerID) {
      await interaction.editReply('This command can only be used in the admin server.');
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
          return `${userMap.get(user.id)} (${inlineCode(user.id)})\n${serverNames.join(', ')}`;
        });

        const listEmbed = new InfoEmbedBuilder(interaction.user, {
          title: 'Whitelisted Users',
          description: userEntries.join('\n\n'),
        });

        await interaction.editReply({ embeds: [listEmbed] });
      } catch (e) {
        Logger.error(`Error getting all users: ${e}`);
        await interaction.editReply('An error occurred while getting all users.');
        return;
      }
    }

    if (subcommand === 'list_by_server') {
      const serverID = args.getString('server_id', true);
      let server;

      try {
        server = await client.guilds.fetch(serverID);
      } catch (e) {
        Logger.error(`Error fetching server: ${e}`);
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
        Logger.error(`Error getting users by server: ${e}`);
        await interaction.editReply('An error occurred while getting users by server.');
        return;
      }
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
        const serverNames = guilds.map((guild) => guild.name);

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
        Logger.error(`Error getting user information: ${e}`);
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
        const dbUser = await UserModelController.createUser({ id: user.id, servers: serverIDs });
        const guilds = await fetchGuilds(serverIDs, client);

        const serverNames = guilds.map((guild) => guild.name);

        await interaction.editReply(
          `Added User ${escapeMarkdown(user.globalName ?? user.username)} with ID ${inlineCode(dbUser.id)} to whitelist.\nThey are allowed to use the bot in the following servers: ${serverNames.join(', ')}`,
        );

        for await (const guild of guilds) {
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
        Logger.error(`Error adding user to whitelist: ${e}`);
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
        const currentUserData = await UserModelController.getUser(user.id);

        if (!currentUserData) {
          await interaction.editReply(
            `User ${escapeMarkdown(user.globalName ?? user.username)} with ID ${inlineCode(user.id)} is not on the whitelist.`,
          );
          return;
        }

        const oldServerIDs = currentUserData ? currentUserData.servers : [];

        const newDbUser = await UserModelController.updateUser({
          id: user.id,
          servers: newServerIDs,
        });
        const newGuilds = await fetchGuilds(newServerIDs, client);
        const newServerNames = newGuilds.map((newGuilds) => newGuilds.name);

        await interaction.editReply(
          `Updated User ${escapeMarkdown(user.globalName ?? user.username)} with ID ${inlineCode(newDbUser.id)} on whitelist.\nThey are allowed to use the bot in the following servers: ${newServerNames.join(', ')}`,
        );

        const serversAdded = newServerIDs.filter((id) => !oldServerIDs.includes(id));
        const serversRemoved = oldServerIDs.filter((id) => !newServerIDs.includes(id));

        for (const serverID of serversAdded) {
          const guild = await client.guilds.fetch(serverID);
          const created = await ServerConfigModelController.createServerConfigIfNotExists(serverID);

          if (created) {
            Logger.info(`Created empty server config for server ${guild.name} (${serverID})`);
            await interaction.followUp(
              `Created empty server config for server ${escapeMarkdown(guild.name)} (${inlineCode(serverID)})`,
            );
          } else {
            Logger.debug(
              `Server config already exists for server ${guild.name} (${serverID}). Skipping creation.`,
            );
          }
        }

        for (const serverID of serversRemoved) {
          const guild = await client.guilds.fetch(serverID);
          const deleted = await ServerConfigModelController.deleteServerConfigIfNeeded(serverID);

          if (deleted) {
            Logger.info(
              `Deleted server config for server ${guild.name} (${serverID}) because it's no longer in use.`,
            );
            await interaction.followUp(
              `Deleted server config for server ${escapeMarkdown(guild.name)} (${inlineCode(serverID)}) because it's no longer in use.`,
            );
          } else {
            Logger.debug(
              `Server config for server ${guild.name} (${serverID}) still in use. Skipping deletion.`,
            );
          }
        }
      } catch (e) {
        Logger.error(`Error updating user on whitelist: ${e}`);
        await interaction.editReply('An error occurred while updating the user on the whitelist.');
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

        for await (const guild of guilds) {
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
        Logger.error(`Error removing user from whitelist: ${e}`);
        await interaction.editReply(
          'An error occurred while removing the user from the whitelist.',
        );
        return;
      }
    }
  },
});

async function fetchGuilds(ids: Snowflake[], client: Client): Promise<Guild[]> {
  return await Promise.all(
    ids.map(async (id) => {
      const server = await client.guilds.fetch(id);
      return server;
    }),
  );
}
