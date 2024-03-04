import { Snowflake, Client } from 'discord.js';

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
