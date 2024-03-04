import { Snowflake } from 'discord.js';
import { pgClient } from '../..';
import { config } from '../../config';

export type DbUser = {
  id: Snowflake;
  servers: Snowflake[];
  created_at: Date;
};

export default abstract class AdminModelController {
  public static async createUser(createUser: {
    id: Snowflake;
    servers: Snowflake[];
  }): Promise<DbUser> {
    createUser.servers.push(config.adminServerID);

    const user = await pgClient.query<DbUser>(
      'INSERT INTO users (id, servers) VALUES ($1, $2) RETURNING *',
      [createUser.id, createUser.servers],
    );

    return user.rows[0];
  }

  public static async getUser(id: Snowflake): Promise<DbUser> {
    const user = await pgClient.query<DbUser>('SELECT * FROM users WHERE id = $1', [id]);

    return user.rows[0];
  }

  public static async updateUser(updateUser: {
    id: Snowflake;
    servers: Snowflake[];
  }): Promise<DbUser> {
    updateUser.servers.push(config.adminServerID);

    const user = await pgClient.query<DbUser>(
      'UPDATE users SET servers = $1 WHERE id = $2 RETURNING *',
      [updateUser.servers, updateUser.id],
    );

    return user.rows[0];
  }

  public static async deleteUser(id: Snowflake): Promise<DbUser> {
    const user = await pgClient.query<DbUser>('DELETE FROM users WHERE id = $1 RETURNING *', [id]);

    return user.rows[0];
  }

  public static async getAllUsers(limit?: Number): Promise<DbUser[]> {
    if (!limit) {
      const users = await pgClient.query<DbUser>('SELECT * FROM users');

      return users.rows;
    } else {
      const users = await pgClient.query<DbUser>('SELECT * FROM users LIMIT $1', [limit]);

      return users.rows;
    }
  }

  public static async getUsersByServer(server: Snowflake): Promise<DbUser[]> {
    const users = await pgClient.query<DbUser>('SELECT * FROM users WHERE $1 = ANY(servers)', [
      server,
    ]);

    return users.rows;
  }
}
