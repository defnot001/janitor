import { Snowflake } from 'discord.js';
import { pgClient } from '../..';

export type DbSpammer = {
  id: Snowflake;
  screenshot_proof: string | null;
  explanation: string | null;
  created_at: Date;
};

export default abstract class SpammerModelController {
  public static async createSpammer(
    id: Snowflake,
    screenshot_proof?: string | null,
    explanation?: string | null,
  ): Promise<DbSpammer> {
    const spammer = await pgClient.query<DbSpammer>(
      'INSERT INTO spammers (id, screenshot_proof, explanation) VALUES ($1, $2, $3) RETURNING *',
      [id, screenshot_proof || null, explanation || null],
    );

    return spammer.rows[0];
  }

  public static async getSpammer(id: Snowflake): Promise<DbSpammer> {
    const spammer = await pgClient.query<DbSpammer>('SELECT * FROM spammers WHERE id = $1', [id]);

    return spammer.rows[0];
  }

  public static async deleteSpammer(id: Snowflake): Promise<DbSpammer> {
    const spammer = await pgClient.query<DbSpammer>(
      'DELETE FROM spammers WHERE id = $1 RETURNING *',
      [id],
    );

    return spammer.rows[0];
  }

  public static async getAllSpammers(): Promise<DbSpammer[]> {
    const spammers = await pgClient.query<DbSpammer>('SELECT * FROM spammers');

    return spammers.rows;
  }

  public static async updateSpammer(updateSpammer: {
    id: Snowflake;
    screenshot_proof?: string | null;
    explanation?: string | null;
  }): Promise<DbSpammer> {
    const previous = await this.getSpammer(updateSpammer.id);

    if (!updateSpammer.screenshot_proof) {
      updateSpammer.screenshot_proof = previous.screenshot_proof;
    }

    if (!updateSpammer.explanation) {
      updateSpammer.explanation = previous.explanation;
    }

    const spammer = await pgClient.query<DbSpammer>(
      'UPDATE spammers SET screenshot_proof = $1, explanation = $2 WHERE id = $3 RETURNING *',
      [updateSpammer.screenshot_proof, updateSpammer.explanation, updateSpammer.id],
    );

    return spammer.rows[0];
  }
}
