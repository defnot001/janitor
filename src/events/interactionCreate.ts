import type { CommandInteractionOptionResolver, Snowflake } from 'discord.js';
import { Event } from '../handler/classes/Event';
import { client } from '..';
import { ExtendedInteraction } from '../handler/types';
import { LOGGER } from '..';

export default new Event('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const { commandName } = interaction;
  const username = interaction.user.globalName ?? interaction.user.username;

  const channelNameAddon = await getChannelNameAddon(interaction.channelId);
  const guildNameAddon = ` (${interaction.guild?.name})`;

  const command = client.commands.get(commandName);

  if (!command) {
    await LOGGER.error(
      `${username} used /${commandName} ${channelNameAddon} but the command does not exist.`,
    );

    await interaction.reply({
      content: `This interaction does not exist!`,
      ephemeral: true,
    });

    return;
  }

  LOGGER.info(
    `${username} (${interaction.user.id}) used /${commandName}${channelNameAddon}${guildNameAddon}.`,
  );

  try {
    return command.execute({
      args: interaction.options as CommandInteractionOptionResolver,
      client,
      interaction: interaction as ExtendedInteraction,
    });
  } catch (e) {
    await LOGGER.error(`An error occurred while executing ${commandName}: ${e}`);

    await interaction.reply({
      content: `There was an error trying to execute the interaction: ${interaction.commandName}!`,
      ephemeral: true,
    });

    return;
  }
});

async function getChannelNameAddon(channelID: Snowflake) {
  const channel = await client.channels.fetch(channelID);

  if (channel && 'name' in channel) {
    return ` in #${channel.name}`;
  }

  return '';
}
