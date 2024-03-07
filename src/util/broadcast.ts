import {
  AttachmentBuilder,
  Client,
  GuildTextBasedChannel,
  Snowflake,
  TextChannel,
} from 'discord.js';
import {
  DbServerConfig,
  ServerConfigModelController,
} from '../database/model/ServerConfigModelController';
import { UserModelController } from '../database/model/UserModelController';
import Logger from './logger';
import { InfoEmbedBuilder } from './builders';
import { BadActorSubcommand } from '../commands/badActor';

type ServerConfig = DbServerConfig & { users: Snowflake[] };
type BroadcastType = Exclude<
  BadActorSubcommand,
  'display_latest' | 'display_by_user' | 'display_by_id'
>;

export abstract class Broadcaster {
  public static async broadcastToAll(
    client: Client,
    options: {
      broadcastType: BroadcastType;
      broadcastMessage: string;
      embed: InfoEmbedBuilder;
      attachment: AttachmentBuilder | null;
    },
  ) {
    const { broadcastType, broadcastMessage, embed, attachment } = options;
    const listenersMap = await this.getListenersMap(client);

    // We can use type assertion here, because we excluded all servers without a log_channel in getListenersMap()
    const serverChannelIDs = Array.from(listenersMap.values()).map((c) => {
      return { guildID: c.server_id, channelID: c.log_channel! };
    });

    const validLogChannels = await this.getValidLogChannels(client, serverChannelIDs);
  }

  private static async broadcastToAdminServer() {
    throw new Error('Method not implemented.');
  }

  private static async getListenersMap(client: Client): Promise<Map<Snowflake, ServerConfig>> {
    const serverConfigs = await ServerConfigModelController.getAllServerConfigs();
    const configMap: Map<Snowflake, ServerConfig> = new Map();

    for await (const config of serverConfigs) {
      if (!config.log_channel) {
        Logger.warn(
          `No logchannel set for server ${config.server_id}. Skipping their for broadcasting.`,
        );
        continue;
      }

      try {
        const users = await UserModelController.getUserListByServer(config.server_id);
        const serverconfig: ServerConfig = { ...config, users: users.map((user) => user.id) };
        configMap.set(config.server_id, serverconfig);
      } catch (e) {
        try {
          const guild = await client.guilds.fetch(config.server_id);
          Logger.error(
            `Failed to get users for server ${guild.name} (${config.server_id}): ${e}. Skipping their server.`,
          );
        } catch (e) {
          Logger.error(
            `Failed to get users for server ${config.server_id}: ${e}. Skipping their server.`,
          );
        }
      }
    }

    return configMap;
  }

  private static async getValidLogChannels(
    client: Client,
    serverChannelIDs: {
      guildID: Snowflake;
      channelID: Snowflake;
    }[],
  ) {
    const validLogChannels: { guildID: Snowflake; logChannel: TextChannel }[] = [];

    for (const { guildID, channelID } of serverChannelIDs) {
      const guild = await client.guilds.fetch(guildID).catch((e) => {
        Logger.error(`Failed to fetch server ${guildID}: ${e}`);
      });

      const displayGuild = guild ? guild.name : guildID;

      try {
        const channel = await client.channels.fetch(channelID);

        if (channel && channel.isTextBased() && channel instanceof TextChannel) {
          validLogChannels.push({ guildID, logChannel: channel });
        } else {
          Logger.warn(
            `Logchannel ${channelID} for server ${displayGuild} is not a text channel. Skipping this channel.`,
          );
        }
      } catch (e) {
        Logger.error(
          `Failed to fetch channel ${channelID} for server ${displayGuild}: ${e}. Skipping this channel.`,
        );
        continue;
      }
    }

    return validLogChannels;
  }
}
