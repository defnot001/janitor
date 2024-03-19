import { AdminModelController } from '../database/model/AdminModelController';
import { Command } from '../handler/classes/Command';
import type { ExtendedClient } from '../handler/classes/ExtendedClient';
import type { ExtendedInteraction } from '../handler/types';
import { InfoEmbedBuilder } from '../util/builders';
import { displayFormatted } from '../util/format';
import { LOGGER } from '../util/logger';
import { checkUserInDatabase } from '../util/permission';

const commandName = 'adminlist';

export default new Command({
	name: commandName,
	description: 'Lists all the admins of the bot',
	execute: async ({ interaction, client }) => {
		await interaction.deferReply();
		if (!(await checkUserInDatabase({ interaction, commandName }))) return;

		await handleAdminList(interaction, client);
	},
});

async function handleAdminList(interaction: ExtendedInteraction, client: ExtendedClient) {
	try {
		const admins = await AdminModelController.getAllAdmins();

		const adminEntries = await Promise.all(
			admins.map(async (a) => {
				const user = await client.users.fetch(a.id);
				return displayFormatted(user);
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
}
