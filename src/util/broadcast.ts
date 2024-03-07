import {
  AttachmentBuilder,
  Client,
  EmbedData,
  Snowflake,
  TextChannel,
  inlineCode,
  time,
  userMention,
} from 'discord.js';
import {
  DbServerConfig,
  ServerConfigModelController,
} from '../database/model/ServerConfigModelController';
import { UserModelController } from '../database/model/UserModelController';
import Logger from './logger';
import { BadActorSubcommand } from '../commands/badActor';
import { DbBadActor } from '../database/model/BadActorModelController';
import { BroadCastEmbedBuilder } from './builders';
import path from 'path';
import { botConfig, projectPaths } from '../config';
import { getTextChannelByID } from '../commands/adminconfig';
type ServerConfig = DbServerConfig & { users: Snowflake[] };
export type BroadcastType = Exclude<
  BadActorSubcommand,
  'display_latest' | 'display_by_user' | 'display_by_id'
>;

export abstract class Broadcaster {
  public static async broadcast(options: {
    client: Client;
    dbBadActor: DbBadActor;
    broadcastType: BroadcastType;
  }) {
    const { client, dbBadActor, broadcastType } = options;
    const listenersMap = await this.getListenersMap(client);

    // We can use type assertion here, because we excluded all servers without a log_channel in getListenersMap()
    const serverChannelIDs = Array.from(listenersMap.values()).map((c) => {
      return { guildID: c.server_id, channelID: c.log_channel! };
    });

    const { embed, attachment } = await this.buildBadActorEmbed(client, dbBadActor, broadcastType);
    const validLogChannels = await this.getValidLogChannels(client, serverChannelIDs);
    const notificationMessage = this.getNotificationMessage(broadcastType);

    try {
      await this.broadcastToAdminServer({
        embed,
        attachment,
        notificationMessage,
        client,
      });
    } catch (e) {
      Logger.error(`Failed to broadcast to admin server: ${e}`);
    }

    try {
      await this.broadcastToServers({
        attachment,
        embed,
        validLogChannels,
        notificationMessage,
        listenersMap,
      });
    } catch (e) {
      Logger.error(`Failed to broadcast to servers: ${e}`);
    }
  }

  private static async broadcastToAdminServer(options: {
    embed: BroadCastEmbedBuilder;
    attachment: AttachmentBuilder | null;
    notificationMessage: string;
    client: Client;
  }) {
    const logChannel = await getTextChannelByID(options.client, botConfig.adminServerLogChannel);

    if (!logChannel) {
      Logger.error(
        `Failed to get log channel ${botConfig.adminServerLogChannel} for admin server. Skipping broadcast to admin server.`,
      );
      return;
    }

    if (options.attachment !== null) {
      await logChannel.send({
        content: options.notificationMessage,
        embeds: [options.embed],
        files: [options.attachment],
      });
      return;
    }

    await logChannel.send({ content: options.notificationMessage, embeds: [options.embed] });
  }

  private static async broadcastToServers(options: {
    embed: BroadCastEmbedBuilder;
    attachment: AttachmentBuilder | null;
    validLogChannels: { guildID: Snowflake; logChannel: TextChannel }[];
    notificationMessage: string;
    listenersMap: Map<Snowflake, ServerConfig>;
  }) {
    const promises = [];

    for (const { guildID, logChannel } of options.validLogChannels) {
      const serverConfig = options.listenersMap.get(guildID);

      if (!serverConfig) {
        Logger.error(`Failed to get server config for server ${guildID}. Skipping their server.`);
        continue;
      }

      let messageContent = options.notificationMessage;

      if (serverConfig.ping_users === true) {
        messageContent = `${serverConfig.users.map((u) => userMention(u)).join(' ')}\n${options.notificationMessage}`;
      }

      if (options.attachment !== null) {
        promises.push(
          logChannel.send({
            content: messageContent,
            embeds: [options.embed],
            files: [options.attachment],
          }),
        );
        continue;
      }

      promises.push(logChannel.send({ content: messageContent, embeds: [options.embed] }));
    }

    await Promise.all(promises);
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

  private static async buildBadActorEmbed(
    client: Client,
    badActor: DbBadActor,
    broadcastType: BroadcastType,
  ) {
    const badActorUser = await client.users.fetch(badActor.user_id).catch((e) => {
      Logger.error(`Failed to fetch user ${badActor.user_id} to create broadcast embed: ${e}`);
      return null;
    });

    const initialGuild = await client.guilds.fetch(badActor.originally_created_in).catch((e) => {
      Logger.error(
        `Failed to fetch guild ${badActor.originally_created_in} to create broadcast embed: ${e}`,
      );
      return null;
    });

    const embedTitle = `Bad Actor ${badActorUser ? badActorUser.globalName ?? badActorUser.username : badActor.user_id}`;
    const initialGuildDisplay = initialGuild
      ? `${initialGuild.name} (${inlineCode(initialGuild.id)})`
      : badActor.originally_created_in;

    const embedData: EmbedData = {
      title: embedTitle,
      fields: [
        { name: 'Database Entry ID', value: inlineCode(badActor.id.toString()) },
        { name: 'User ID', value: inlineCode(badActor.user_id) },
        { name: 'Active', value: badActor.is_active ? 'Yes' : 'No' },
        { name: 'Type', value: badActor.actor_type },
        {
          name: 'Explanation/Reason',
          value: badActor.explanation ?? 'No explanation provided.',
        },
        {
          name: 'Server of Origin',
          value: initialGuildDisplay,
        },
        {
          name: 'Created At',
          value: `${time(new Date(badActor.created_at), 'D')}\n(${time(
            new Date(badActor.created_at),
            'R',
          )})`,
        },
        {
          name: 'Last Updated At',
          value: `${time(new Date(badActor.updated_at), 'D')}\n(${time(
            new Date(badActor.updated_at),
            'R',
          )})`,
        },
        {
          name: 'Last Updated By',
          value: `${userMention(badActor.last_changed_by)} (${inlineCode(badActor.last_changed_by)})`,
        },
      ],
    };

    const embed = new BroadCastEmbedBuilder(embedData, {
      broadcastType,
      clientUser: client.user ?? undefined,
    });

    if (badActorUser) {
      embed.setThumbnail(badActorUser.displayAvatarURL());
    }

    let attachment: AttachmentBuilder | null = null;

    if (badActor.screenshot_proof) {
      try {
        attachment = new AttachmentBuilder(
          path.join(projectPaths.sources, '..', 'screenshots', badActor.screenshot_proof),
        );
      } catch (e) {
        Logger.error(`Failed to create attachment for bad actor ${badActor.id}: ${e}`);
      }
    }

    if (attachment) {
      embed.setImage(`attachment://${badActor.screenshot_proof}`);
    }

    return { embed, attachment };
  }

  private static getNotificationMessage(broadcastType: BroadcastType) {
    let description: string | null = null;

    switch (broadcastType) {
      case 'report':
        description = 'A bad actor has been reported.';
        break;
      case 'deactivate':
        description = 'A bad actor has been deactivated.';
        break;
      case 'reactivate':
        description = 'A bad actor has been reactivated.';
        break;
      case 'add_screenshot':
        description = 'A screenshot proof has been added to a bad actor entry.';
        break;
      case 'update_explanation':
        description = 'The explanation for a bad actor has been updated.';
        break;
      case 'replace_screenshot':
        description = 'A screenshot has been replaced for a bad actor.';
        break;
      default:
        description = 'Unknown broadcast type.';
    }

    return description;
  }
}
