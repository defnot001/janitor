import { Snowflake } from 'discord.js';
import { pgClient } from '../..';

/**
 * CREATE TABLE IF NOT EXISTS server_configs (
    server_id VARCHAR(20) NOT NULL,
    log_channel VARCHAR(20),
    ping_users BOOLEAN NOT NULL DEFAULT FALSE,
    action_level INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    primary key (id)
);
 */

export type DbServerConfig = {
  server_id: Snowflake;
  log_channel: Snowflake | null;
  ping_users: boolean;
  action_level: number;
  created_at: Date;
  updated_at: Date;
};

type CreateServerConfig = {
  server_id: Snowflake;
  action_level?: number | null;
  log_channel?: Snowflake | null;
  ping_users?: boolean | null;
};

export default abstract class ServerConfigModelController {
  public static async createServerConfig(
    createServerConfig: CreateServerConfig,
  ): Promise<DbServerConfig> {
    const serverConfig = await pgClient.query<DbServerConfig>(
      'INSERT INTO server_configs (server_id, log_channel, ping_users, action_level) VALUES ($1, $2, $3, $4) RETURNING *',
      [
        createServerConfig.server_id,
        createServerConfig.log_channel || null,
        createServerConfig.ping_users || false,
        createServerConfig.action_level || 0,
      ],
    );

    return serverConfig.rows[0];
  }

  public static async getServerConfig(server_id: Snowflake): Promise<DbServerConfig> {
    const serverConfig = await pgClient.query<DbServerConfig>(
      'SELECT * FROM server_configs WHERE server_id = $1',
      [server_id],
    );

    return serverConfig.rows[0];
  }

  public static async getAllServerConfigs(): Promise<DbServerConfig[]> {
    const serverConfigs = await pgClient.query<DbServerConfig>('SELECT * FROM server_configs');

    return serverConfigs.rows;
  }

  public static async updateServerConfig(
    updateServerConfig: CreateServerConfig,
  ): Promise<DbServerConfig> {
    const currentServerConfig = await this.getServerConfig(updateServerConfig.server_id);

    const actionLevel = updateServerConfig.action_level || currentServerConfig.action_level;
    const logChannel = updateServerConfig.log_channel || currentServerConfig.log_channel;
    const pingUsers = updateServerConfig.ping_users || currentServerConfig.ping_users;

    const serverConfig = await pgClient.query<DbServerConfig>(
      'UPDATE server_configs SET log_channel = $1, ping_users = $2, action_level = $3, updated_at = CURRENT_TIMESTAMP WHERE server_id = $4 RETURNING *',
      [logChannel, pingUsers, actionLevel, updateServerConfig.server_id],
    );

    return serverConfig.rows[0];
  }

  public static async deleteServerConfig(server_id: Snowflake): Promise<DbServerConfig> {
    const serverConfig = await pgClient.query<DbServerConfig>(
      'DELETE FROM server_configs WHERE server_id = $1 RETURNING *',
      [server_id],
    );

    return serverConfig.rows[0];
  }
}
