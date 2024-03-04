import { ApplicationCommandOptionType } from 'discord.js';
import { Command } from '../handler/classes/Command';
import Logger from '../log/logger';

export default new Command({
  name: 'adduser',
  description: 'Add a user to the whitelist.',
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
        'The ID(s) of the server that the user is allowed to use the bot on. Seperate multiple server IDs with a comma.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  execute: async ({ interaction, args }) => {
    const user = args.getUser('user', true);

    Logger.log(`Adding user ${user.tag} to the whitelist.`, 'debug');
    await interaction.reply('Testing');
  },
});
