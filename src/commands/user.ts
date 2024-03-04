import { ApplicationCommandOptionType } from 'discord.js';
import { Command } from '../handler/classes/Command';
import Logger from '../log/logger';

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
          name: 'serverID',
          description:
            'The server(s) that the user should be able to use the bot in. Separate multiple serverIDs with a comma. The admin server ID is always included.',
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
      name: 'get_by_server',
      description: 'Get all users on the whitelist for a specific server.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'serverID',
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
          name: 'serverID',
          description:
            'The server(s) that the user should be able to use the bot in. Separate multiple serverIDs with a comma. The admin server ID is always included.',
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
  execute: async ({ interaction, args }) => {
    await interaction.deferReply();
    const subcommand = args.getSubcommand() as
      | 'add'
      | 'list'
      | 'info'
      | 'get_by_server'
      | 'update'
      | 'remove';

    if (subcommand === 'add') {
      const user = args.getUser('user');
      const serverID = args.getString('serverID');

      if (!user) {
        return interaction.editReply('User not found.');
      }
    }
  },
});
