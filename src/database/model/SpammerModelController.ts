import { Snowflake } from 'discord.js';
import { pgClient } from '../..';

export type DbSpammer = {
  id: Snowflake;
  is_active: boolean;
  screenshot_proof: string | null;
  explanation: string | null;
  created_at: Date;
  updated_at: Date;
  last_changed_by: Snowflake;
};

export abstract class SpammerModelController {
  public static async createSpammer(options: {
    id: Snowflake;
    last_changed_by: Snowflake;
    screenshot_proof?: string | null;
    explanation?: string | null;
    is_active?: boolean;
  }): Promise<DbSpammer> {
    const { id, last_changed_by, screenshot_proof, explanation, is_active = true } = options;

    const spammer = await pgClient.query<DbSpammer>(
      'INSERT INTO spammers (id, screenshot_proof, explanation, is_active, last_changed_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id, screenshot_proof || null, explanation || null, is_active, last_changed_by],
    );

    return spammer.rows[0];
  }

  public static async getSpammer(id: Snowflake): Promise<DbSpammer> {
    const spammer = await pgClient.query<DbSpammer>('SELECT * FROM spammers WHERE id = $1', [id]);

    return spammer.rows[0];
  }

  public static async deactivateSpammer(options: {
    id: Snowflake;
    explanation: string;
    last_changed_by: Snowflake;
  }): Promise<DbSpammer> {
    const spammer = await pgClient.query<DbSpammer>(
      'UPDATE spammers SET is_active = false, explanation = $2, last_changed_by = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [options.id, options.explanation, options.last_changed_by],
    );

    return spammer.rows[0];
  }

  public static async reactivateSpammer(options: {
    id: Snowflake;
    explanation: string;
    last_changed_by: Snowflake;
  }): Promise<DbSpammer> {
    const spammer = await pgClient.query<DbSpammer>(
      'UPDATE spammers SET is_active = true, explanation = $2, last_changed_by = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [options.id, options.explanation, options.last_changed_by],
    );

    return spammer.rows[0];
  }

  public static async deleteSpammer(id: Snowflake): Promise<DbSpammer> {
    const spammer = await pgClient.query<DbSpammer>(
      'DELETE FROM spammers WHERE id = $1 RETURNING *',
      [id],
    );

    return spammer.rows[0];
  }

  public static async getSpammers(limit?: number): Promise<DbSpammer[]> {
    let query = 'SELECT * FROM spammers ORDER BY created_at DESC';
    const values: number[] = [];

    if (limit !== undefined) {
      query += ' LIMIT $1';
      values.push(limit);
    }

    const result = await pgClient.query<DbSpammer>(query, values);
    return result.rows;
  }
}
