import { APIEmbed, Client, ClientUser, EmbedBuilder, EmbedData, User } from 'discord.js';
import { BroadcastType } from './broadcast';

export class InfoEmbedBuilder extends EmbedBuilder {
  constructor(user: User, data?: EmbedData | APIEmbed) {
    super(data);

    this.setColor(3_517_048);

    this.setFooter({
      text: `Requested by ${user.username}`,
      iconURL: user.displayAvatarURL(),
    });

    this.setTimestamp(Date.now());
  }
}

export class BroadCastEmbedBuilder extends EmbedBuilder {
  constructor(
    embedData: APIEmbed | EmbedData,
    options: {
      clientUser: ClientUser | undefined;
      broadcastType: BroadcastType;
    },
  ) {
    super(embedData);

    this.setColor(getBroadcastEmbedColor(options.broadcastType));

    this.setFooter({
      text: `TMC Janitor Broadcast`,
      iconURL: options.clientUser?.displayAvatarURL(),
    });

    this.setTimestamp(Date.now());
  }
}

function getBroadcastEmbedColor(broadcastType: BroadcastType) {
  if (broadcastType === 'report' || broadcastType === 'reactivate') {
    return 16_711_680; // red
  }

  if (broadcastType === 'update_explanation' || broadcastType === 'replace_screenshot') {
    return 16_776_960; // yellow
  }

  return 6_684_416; // green
}
