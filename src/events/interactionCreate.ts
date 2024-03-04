import type { CommandInteractionOptionResolver, TextBasedChannel } from 'discord.js';
import { Event } from '../handler/classes/Event';
import { client } from '..';
import { ExtendedInteraction } from '../handler/types';
import Logger from '../log/logger';

export default new Event('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const { commandName } = interaction;
  const username = interaction.user.globalName ?? interaction.user.username;
  const channelNameAddon = getChannelNameAddon(interaction.channel);

  const command = client.commands.get(commandName);

  if (!command) {
    Logger.error(
      `${username} used ${commandName} ${channelNameAddon} but the command does not exist.`,
    );

    await interaction.reply({
      content: `This interaction does not exist!`,
      ephemeral: true,
    });

    return;
  }

  Logger.info(`${username} used ${commandName} ${channelNameAddon}.`);

  try {
    return command.execute({
      args: interaction.options as CommandInteractionOptionResolver,
      client,
      interaction: interaction as ExtendedInteraction,
    });
  } catch (e) {
    Logger.error(`An error occurred while executing ${commandName}: ${e}`);

    await interaction.reply({
      content: `There was an error trying to execute the interaction: ${interaction.commandName}!`,
      ephemeral: true,
    });

    return;
  }
});

function getChannelNameAddon(channel: TextBasedChannel | null): string {
  if (channel && 'name' in channel) {
    return `in #${channel.name}`;
  }

  return '';
}
