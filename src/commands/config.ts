import {
  ApplicationCommandOptionType,
  CommandInteraction,
  Guild,
  Interaction,
  User,
  inlineCode,
  time,
} from 'discord.js';
import { Command } from '../handler/classes/Command';
import { DbUser, UserModelController } from '../database/model/UserModelController';
import { config } from '../config';
import { InfoEmbedBuilder } from '../util/builders';
import {
  DbServerConfig,
  ServerConfigModelController,
  displayActionLevel,
} from '../database/model/ServerConfigModelController';
import { getTextChannelByID } from './adminconfig';
import Logger from '../util/logger';

export default new Command({
  name: 'config',
  description: 'Configure the bot for your server',
  options: [
    {
      name: 'display',
      description: 'Display the current configuration',
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: 'update',
      description: 'Change the configuration of the bot',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'logchannel',
          description: 'The channel to log actions to',
          type: ApplicationCommandOptionType.String,
        },
        {
          name: 'pingusers',
          description: 'Whether or not to ping users when action is taken',
          type: ApplicationCommandOptionType.Boolean,
        },
        {
          name: 'actionlevel',
          description: 'The level of action to take',
          type: ApplicationCommandOptionType.Integer,
          choices: [
            {
              name: 'Notify',
              value: 0,
            },
            {
              name: 'Timeout',
              value: 1,
            },
            {
              name: 'Kick',
              value: 2,
            },
            {
              name: 'Soft Ban',
              value: 3,
            },
            {
              name: 'Ban',
              value: 4,
            },
          ],
        },
        {
          name: 'timeoutuserswithrole',
          description: 'Whether or not to timeout users with a specific role',
          type: ApplicationCommandOptionType.Boolean,
        },
        {
          name: 'ignoredroles',
          description:
            'Role IDs to ignore when taking action. Separate multiple roles with a comma',
          type: ApplicationCommandOptionType.String,
        },
      ],
    },
  ],
  execute: async ({ interaction, args }) => {
    await interaction.deferReply();

    const interactionGuild = interaction.guild;

    if (!interactionGuild) {
      await interaction.editReply('This command can only be used in a server.');
      Logger.warn(
        `${interaction.user.globalName ?? interaction.user.username} tried to use the config command outside of a guild.`,
      );
      return;
    }

    const dbUser = await isUserAllowed(interactionGuild, interaction);
    if (!dbUser) return;

    const subcommand = args.getSubcommand() as 'display' | 'update';

    if (interactionGuild.id === config.adminServerID) {
      await interaction.editReply('This command is not available in the admin server.');
      return;
    }

    if (subcommand === 'display') {
      try {
        const serverConfig = await ServerConfigModelController.getServerConfig(interactionGuild.id);

        if (!serverConfig) {
          await interaction.editReply('Server config not found.');
          return;
        }

        const embed = buildServerConfigEmbed({
          guild: interactionGuild,
          user: interaction.user,
          serverConfig,
        });

        await interaction.editReply({ embeds: [embed] });
      } catch (e) {
        await interaction.editReply(`Failed to get server config: ${e}`);
        return;
      }
    }

    if (subcommand === 'update') {
      const logChannel = args.getString('logchannel');
      const pingUsers = args.getBoolean('pingusers');
      const actionLevel = args.getInteger('actionlevel');
      const timeoutUsersWithRole = args.getBoolean('timeoutuserswithrole');
      const ignoredRoles =
        args
          .getString('ignoredroles')
          ?.split(',')
          .map((id) => id.trim()) ?? [];

      try {
        const serverConfig = await ServerConfigModelController.updateServerConfig({
          server_id: interactionGuild.id,
          log_channel: logChannel,
          ping_users: pingUsers,
          action_level: actionLevel,
          timeout_users_with_role: timeoutUsersWithRole,
          ignored_roles: ignoredRoles,
        });

        if (!serverConfig) {
          await interaction.editReply('Server config not found.');
          return;
        }

        const embed = buildServerConfigEmbed({
          guild: interactionGuild,
          user: interaction.user,
          serverConfig,
        });

        await interaction.editReply({ content: 'Updated Serverconfig', embeds: [embed] });
      } catch (e) {
        await interaction.editReply(`Failed to update server config: ${e}`);
        return;
      }
    }
  },
});

async function isUserAllowed(
  guild: Guild,
  interaction: CommandInteraction,
): Promise<DbUser | null> {
  try {
    const dbUser = await UserModelController.getUser(interaction.user.id);

    if (!dbUser) {
      await interaction.editReply('You are not allowed to use this command.');
      Logger.warn(
        `User ${interaction.user.globalName ?? interaction.user.username} attempted to use /config in ${guild.name} but the user does not exist in the database.`,
      );
      return null;
    }

    if (!dbUser.servers.includes(guild.id) || guild.id === config.adminServerID) {
      await interaction.editReply('You are not allowed to use this command here.');
      Logger.warn(
        `${interaction.user.globalName ?? interaction.user.username} attempted to use /config in ${guild.name} but the user is not allowed to use it there.`,
      );
      return null;
    }

    return dbUser;
  } catch (e) {
    await interaction.editReply(`Failed to get user: ${e}`);
    Logger.error(`Failed to get user from the database: ${e}`);
    return null;
  }
}

function buildServerConfigEmbed(details: {
  user: User;
  guild: Guild;
  serverConfig: DbServerConfig;
}) {
  const logChannel = details.serverConfig.log_channel
    ? `<#${details.serverConfig.log_channel}>`
    : 'Not set';

  return new InfoEmbedBuilder(details.user, {
    title: `Server Config for ${details.guild.name}`,
    fields: [
      {
        name: 'Server ID',
        value: inlineCode(details.guild.id),
      },
      {
        name: 'Log Channel',
        value: logChannel,
      },
      {
        name: 'Ping Admins',
        value: details.serverConfig.ping_users ? 'Enabled' : 'Disabled',
      },
      {
        name: 'Action Level',
        value: displayActionLevel(details.serverConfig.action_level),
      },
      {
        name: 'Timeout Users With Role',
        value: details.serverConfig.timeout_users_with_role ? 'Enabled' : 'Disabled',
      },
      {
        name: 'Ignored Roles',
        value: details.serverConfig.ignored_roles.join('\n') || 'None',
      },
      {
        name: 'Created At',
        value: `${time(new Date(details.serverConfig.created_at), 'D')}\n(${time(
          new Date(details.serverConfig.created_at),
          'R',
        )})`,
        inline: true,
      },
      {
        name: 'Updated At',
        value: `${time(new Date(details.serverConfig.updated_at), 'D')}\n(${time(
          new Date(details.serverConfig.updated_at),
          'R',
        )})`,
        inline: true,
      },
    ],
  });
}
