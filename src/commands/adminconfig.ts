import {
  ApplicationCommandOptionType,
  ChannelType,
  Client,
  Snowflake,
  TextChannel,
  escapeMarkdown,
  inlineCode,
  time,
} from 'discord.js';
import { Command } from '../handler/classes/Command';
import { AdminModelController } from '../database/model/AdminModelController';
import { config } from '../config';
import Logger from '../log/logger';
import {
  ServerConfigModelController,
  displayActionLevel,
} from '../database/model/ServerConfigModelController';
import { UserModelController } from '../database/model/UserModelController';
import { InfoEmbedBuilder } from '../util/builders';
import { SpammerModelController } from '../database/model/SpammerModelController';

export default new Command({
  name: 'adminconfig',
  description: "Subcommands for admins to inspect the bot's server configs",
  options: [
    {
      name: 'display_configs',
      description: 'Display the server configs for one or multiple servers',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'server',
          description:
            'The ID(s) of the server(s) to display the config for. Separate multiple IDs with a comma (,). Max 5.',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: 'delete_spammer',
      description: 'Delete a spammer from the database',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description: 'The user to delete from the spammer list',
          type: ApplicationCommandOptionType.User,
          required: true,
        },
      ],
    },
  ],
  execute: async ({ interaction, args, client }) => {
    await interaction.deferReply();

    if (!(await AdminModelController.isAdmin(interaction.user.id))) {
      await interaction.editReply('You do not have permission to use this command.');
      Logger.warn(`${interaction.user.username} attempted to use /adminconfig without permission.`);
      return;
    }

    if (!interaction.guild || interaction.guild.id !== config.adminServerID) {
      await interaction.editReply('This command can only be used in the admin server.');
      Logger.warn(
        `${interaction.user.username} attempted to use /adminconfig outside of the admin server.`,
      );
      return;
    }

    const subcommand = args.getSubcommand() as 'display_configs' | 'delete_spammer';

    if (subcommand === 'display_configs') {
      const serverIDs = args
        .getString('server', true)
        .split(',')
        .map((id) => id.trim());

      if (!serverIDs.length) {
        await interaction.editReply('You must provide at least one server ID.');
        return;
      }

      if (serverIDs.length > 5) {
        await interaction.editReply(
          'You can only display the configs for up to 5 servers at a time.',
        );
        return;
      }

      try {
        const serverConfigs = await ServerConfigModelController.getServerConfigs(serverIDs);

        if (!serverConfigs.length) {
          await interaction.editReply('No server configs found for the provided server IDs.');
          return;
        }

        const embeds = await Promise.all(
          serverConfigs.map(async (sc) => {
            const guild = await client.guilds.fetch(sc.server_id);
            const userIDs = await UserModelController.getUsersByServer(guild.id);
            const users = await Promise.all(
              userIDs.map(async (dbuser) => await client.users.fetch(dbuser.id)),
            );
            const logChannel = sc.log_channel
              ? await getTextChannelByID(client, sc.log_channel)
              : null;

            const embed = new InfoEmbedBuilder(interaction.user, {
              title: `Server Config for ${guild.name}`,
              fields: [
                {
                  name: 'Server ID',
                  value: inlineCode(guild.id),
                },
                {
                  name: 'Whitelisted Admins',
                  value: `${users.map((u) => `${escapeMarkdown(u.globalName ?? u.username)} (${inlineCode(u.id)})`).join('\n')}`,
                },
                {
                  name: 'Log Channel',
                  value: logChannel
                    ? `${logChannel.name} (${inlineCode(logChannel.id)})`
                    : 'Not set',
                },
                {
                  name: 'Ping Admins',
                  value: sc.ping_users ? 'Enabled' : 'Disabled',
                },
                {
                  name: 'Action Level',
                  value: displayActionLevel(sc.action_level),
                },
                {
                  name: 'Timeout Users With Role',
                  value: sc.timeout_users_with_role ? 'Enabled' : 'Disabled',
                },
                {
                  name: 'Created At',
                  value: `${time(new Date(sc.created_at), 'D')}\n(${time(new Date(sc.created_at), 'R')})`,
                  inline: true,
                },
                {
                  name: 'Updated At',
                  value: `${time(new Date(sc.updated_at), 'D')}\n(${time(new Date(sc.updated_at), 'R')})`,
                  inline: true,
                },
              ],
            });

            if (guild.iconURL()) {
              embed.setThumbnail(guild.iconURL());
            }

            return embed;
          }),
        );

        await interaction.editReply({ embeds });
      } catch (e) {
        await interaction.editReply('An error occurred while fetching the server configs.');
        Logger.error(`An error occurred while fetching the server configs: ${e}`);
        return;
      }
    }

    if (subcommand === 'delete_spammer') {
      const user = args.getUser('user', true);

      try {
        const dbSpammer = await SpammerModelController.getSpammer(user.id);

        if (!dbSpammer) {
          await interaction.editReply('The user is not in the spammer list.');
          return;
        }

        await UserModelController.deleteUser(user.id);

        await interaction.editReply(
          `User ${escapeMarkdown(user.globalName ?? user.username)} (${inlineCode(
            user.id,
          )}) has been deleted from the database.`,
        );

        Logger.info(
          `${interaction.user.username} deleted user ${user.globalName ?? user.username} from the spammer list.`,
        );
      } catch (e) {
        await interaction.editReply('An error occurred while deleting the user from the database.');
        Logger.error(`An error occurred while deleting the user from the database: ${e}`);
        return;
      }
    }
  },
});

export async function getTextChannelByID(
  client: Client,
  id: Snowflake,
): Promise<TextChannel | null> {
  try {
    const channel = await client.channels.fetch(id);

    if (channel && channel.isTextBased() && channel.type === ChannelType.GuildText) {
      return channel as TextChannel;
    }

    Logger.warn(`Logchannel with ID ${id} is not a valid text channel.`);
    return null;
  } catch (e) {
    Logger.error(`An error occurred while fetching channel with ID ${id}: ${e}`);
    return null;
  }
}