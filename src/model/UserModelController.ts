import { Snowflake } from 'discord.js';
import { pgClient } from '..';

type User = {
  id: Snowflake;
  servers: string[];
  created_at: Date;
};

export default abstract class AdminModelController {
  public static async createUser(id: Snowflake, servers: string[]): Promise<User> {
    const user = await pgClient.query<User>(
      'INSERT INTO users (id, servers) VALUES ($1, $2) RETURNING *',
      [id, servers],
    );

    return user.rows[0];
  }

  public static async getUser(id: Snowflake): Promise<User> {
    const user = await pgClient.query<User>('SELECT * FROM users WHERE id = $1', [id]);

    return user.rows[0];
  }

  public static async updateUser(id: Snowflake, servers: string[]): Promise<User> {
    const user = await pgClient.query<User>(
      'UPDATE users SET servers = $1 WHERE id = $2 RETURNING *',
      [servers, id],
    );

    return user.rows[0];
  }

  public static async deleteUser(id: Snowflake): Promise<User> {
    const user = await pgClient.query<User>('DELETE FROM users WHERE id = $1 RETURNING *', [id]);

    return user.rows[0];
  }

  public static async getAllUsers(): Promise<User[]> {
    const users = await pgClient.query<User>('SELECT * FROM users');

    return users.rows;
  }

  public static async getUsersByServer(server: string): Promise<User[]> {
    const users = await pgClient.query<User>('SELECT * FROM users WHERE $1 = ANY(servers)', [
      server,
    ]);

    return users.rows;
  }
}
