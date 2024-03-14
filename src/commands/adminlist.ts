import { Command } from '../handler/classes/Command';
import { AdminModelController } from '../database/model/AdminModelController';
import { InfoEmbedBuilder } from '../util/builders';
import { LOGGER } from '../util/logger';
import { checkUserInDatabase } from '../util/permission';
import { displayUserFormatted } from '../util/discord';

const commandName = 'adminlist';

export default new Command({
  name: commandName,
  description: 'Lists all the admins of the bot',
  execute: async ({ interaction, client }) => {
    await interaction.deferReply();
    if (!(await checkUserInDatabase({ interaction, commandName }))) return;

    try {
      const admins = await AdminModelController.getAllAdmins();

      const adminEntries = await Promise.all(
        admins.map(async (a) => {
          const user = await client.users.fetch(a.id);
          return displayUserFormatted(user);
        }),
      );

      const adminEmbed = new InfoEmbedBuilder(interaction.user, {
        title: 'Admin List',
        description: adminEntries.join('\n'),
      });

      await interaction.editReply({ embeds: [adminEmbed] });
    } catch (e) {
      await LOGGER.error(`Error fetching admins: ${e}`);
      await interaction.editReply('Error fetching admins.');
    }
  },
});
