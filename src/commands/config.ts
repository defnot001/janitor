import { ApplicationCommandOptionType, Guild, User, inlineCode, time } from 'discord.js';
import { Command } from '../handler/classes/Command';
import { botConfig } from '../config';
import { InfoEmbedBuilder } from '../util/builders';
import {
  DbServerConfig,
  ServerConfigModelController,
  displayActionLevel,
} from '../database/model/ServerConfigModelController';
import { checkUserInDatabase } from '../util/permission';

const commandName = 'config';

export default new Command({
  name: commandName,
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
          type: ApplicationCommandOptionType.Channel,
        },
        {
          name: 'pingusers',
          description: 'Whether or not to ping users when action is taken',
          type: ApplicationCommandOptionType.Boolean,
        },
        {
          name: 'pingrole',
          description: 'The role to ping when actions are taken',
          type: ApplicationCommandOptionType.Role,
        },
        {
          name: 'spam_actionlevel',
          description: 'The level of action to take for spamming users with hacked accounts',
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
          name: 'impersonation_actionlevel',
          description: 'The level of action to take for users impersonating others',
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
          name: 'bigotry_actionlevel',
          description: 'The level of action to take for users using bigoted language',
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

    const details = await checkUserInDatabase({ interaction, commandName });
    if (!details) return;

    if (details.guild.id === botConfig.adminServerID) {
      await interaction.editReply('This command is not available in the admin server.');
      return;
    }

    const subcommand = args.getSubcommand() as 'display' | 'update';

    if (subcommand === 'display') {
      try {
        const serverConfig = await ServerConfigModelController.getServerConfig(details.guild.id);

        if (!serverConfig) {
          await interaction.editReply('Server config not found.');
          return;
        }

        const embed = buildServerConfigEmbed({
          guild: details.guild,
          user: interaction.user,
          serverConfig,
        });

        await interaction.editReply({ embeds: [embed] });
        return;
      } catch (e) {
        await interaction.editReply(`Failed to get server config: ${e}`);
        return;
      }
    }

    if (subcommand === 'update') {
      const logChannel = args.getChannel('logchannel');
      const pingUsers = args.getBoolean('pingusers');
      const pingRole = args.getRole('pingrole');
      const spamActionLevel = args.getInteger('spam_actionlevel');
      const impersonationActionLevel = args.getInteger('impersonation_actionlevel');
      const bigotryActionLevel = args.getInteger('bigotry_actionlevel');
      const timeoutUsersWithRole = args.getBoolean('timeoutuserswithrole');
      const ignoredRoles =
        args
          .getString('ignoredroles')
          ?.split(',')
          .map((id) => id.trim()) ?? [];

      try {
        const serverConfig = await ServerConfigModelController.updateServerConfig({
          server_id: details.guild.id,
          log_channel: logChannel?.id,
          ping_users: pingUsers,
          ping_role: pingRole?.id,
          spam_action_level: spamActionLevel,
          impersonation_action_level: impersonationActionLevel,
          bigotry_action_level: bigotryActionLevel,
          timeout_users_with_role: timeoutUsersWithRole,
          ignored_roles: ignoredRoles,
        });

        if (!serverConfig) {
          await interaction.editReply('Server config not found.');
          return;
        }

        const embed = buildServerConfigEmbed({
          guild: details.guild,
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
        name: 'Ping Role',
        value: details.serverConfig.ping_role ? `<@&${details.serverConfig.ping_role}>` : 'Not set',
      },
      {
        name: 'Spam Action Level',
        value: displayActionLevel(details.serverConfig.spam_action_level),
      },
      {
        name: 'Impersonation Action Level',
        value: displayActionLevel(details.serverConfig.impersonation_action_level),
      },
      {
        name: 'Bigotry Action Level',
        value: displayActionLevel(details.serverConfig.bigotry_action_level),
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
