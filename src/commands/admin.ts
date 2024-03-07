import { ApplicationCommandOptionType, escapeMarkdown, inlineCode } from 'discord.js';
import { Command } from '../handler/classes/Command';
import { botConfig } from '../config';
import { AdminModelController } from '../database/model/AdminModelController';
import { InfoEmbedBuilder } from '../util/builders';
import Logger from '../util/logger';

export default new Command({
  name: 'admin',
  description: 'Subcommands for managing admins',
  options: [
    {
      name: 'add',
      description: 'Add an admin',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description: 'The user to add',
          type: ApplicationCommandOptionType.User,
          required: true,
        },
      ],
    },
    {
      name: 'list',
      description: 'List all admins',
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: 'remove',
      description: 'Remove an admin',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description: 'The user to remove',
          type: ApplicationCommandOptionType.User,
          required: true,
        },
      ],
    },
  ],
  execute: async ({ interaction, args, client }) => {
    await interaction.deferReply();

    if (interaction.user.id !== botConfig.superuser) {
      await interaction.editReply('You do not have permission to use this command.');
      Logger.warn(`${interaction.user.username} attempted to use /admin without permission.`);
      return;
    }

    if (!interaction.guild || interaction.guild.id !== botConfig.adminServerID) {
      await interaction.editReply('This command can only be used in the admin server.');
      Logger.warn(
        `${interaction.user.username} attempted to use /admin outside of the admin server.`,
      );
      return;
    }

    const subcommand = args.getSubcommand() as 'add' | 'list' | 'remove';

    if (subcommand === 'list') {
      try {
        const admins = await AdminModelController.getAllAdmins();

        const adminEntries = admins.map(async (a) => {
          const user = await client.users.fetch(a.id);
          return `${escapeMarkdown(user.globalName ?? user.username)} (${inlineCode(user.id)})`;
        });

        const adminEmbed = new InfoEmbedBuilder(interaction.user, {
          title: 'Admin List',
          description: (await Promise.all(adminEntries)).join('\n'),
        });

        await interaction.editReply({ embeds: [adminEmbed] });
      } catch (e) {
        Logger.error(`Error fetching admins: ${e}`);
        await interaction.editReply('Error fetching admins.');
      }
    }

    if (subcommand === 'add') {
      const user = args.getUser('user');

      if (!user) {
        return interaction.editReply('Invalid user.');
      }

      try {
        await AdminModelController.createAdmin(user.id);
        await interaction.editReply(
          `Added ${escapeMarkdown(user.globalName ?? user.username)} as an admin.`,
        );
      } catch (e) {
        Logger.error(`Error adding admin: ${e}`);
        await interaction.editReply('Error adding admin.');
      }
    }

    if (subcommand === 'remove') {
      const user = args.getUser('user');

      if (!user) {
        return interaction.editReply('Invalid user.');
      }

      try {
        await AdminModelController.deleteAdmin(user.id);
        await interaction.editReply(
          `Removed ${escapeMarkdown(user.globalName ?? user.username)} as an admin.`,
        );
      } catch (e) {
        Logger.error(`Error removing admin: ${e}`);
        await interaction.editReply('Error removing admin.');
      }
    }
  },
});
