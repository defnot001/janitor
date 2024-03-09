import {
  Snowflake,
  Client,
  ButtonStyle,
  ButtonBuilder,
  ActionRowBuilder,
  TextChannel,
  ComponentType,
  GuildMember,
  Guild,
  User,
} from 'discord.js';
import { ExtendedInteraction } from '../handler/types';

export async function getServerMap(
  serverIDs: Snowflake[],
  client: Client,
): Promise<Map<Snowflake, string>> {
  const serverMap: Map<Snowflake, string> = new Map();

  for (const serverID of serverIDs) {
    const server = await client.guilds.fetch(serverID);
    serverMap.set(serverID, server.name);
  }

  return serverMap;
}

export async function getUserMap(
  userIDs: Snowflake[],
  client: Client,
): Promise<Map<Snowflake, string>> {
  const userMap: Map<Snowflake, string> = new Map();

  for (const userID of userIDs) {
    const discordUser = await client.users.fetch(userID);
    userMap.set(userID, discordUser.globalName ?? discordUser.username);
  }

  return userMap;
}

export function getConfirmCancelRow() {
  const confirmButton = new ButtonBuilder({
    style: ButtonStyle.Success,
    label: 'Confirm',
    customId: 'confirm',
  });

  const cancelButton = new ButtonBuilder({
    style: ButtonStyle.Danger,
    label: 'Cancel',
    customId: 'cancel',
  });

  return new ActionRowBuilder<ButtonBuilder>({
    components: [confirmButton, cancelButton],
  });
}

export function getButtonCollector(interaction: ExtendedInteraction) {
  const { channel } = interaction;
  if (!channel) return;

  if (channel instanceof TextChannel) {
    return channel.createMessageComponentCollector<ComponentType.Button>({
      filter: (i) => i.user.id === interaction.user.id,
      max: 1,
      time: 10000,
    });
  }

  return;
}

export async function getGuildMember(options: {
  guild: Guild;
  user: User;
  client: Client;
}): Promise<GuildMember | null> {
  const { guild, user } = options;

  try {
    const guildMember = await guild.members.fetch(user.id);
    return guildMember;
  } catch {
    return null;
  }
}
