import { Attachment, AttachmentBuilder, Snowflake } from 'discord.js';
import path from 'path';
import * as fs from 'fs/promises';
import Logger from '../log/logger';

export class Screenshot {
  private readonly storage_directory_path = 'screenshots';
  private readonly renamed_file_name: string;

  public constructor(
    public readonly attachment: Attachment,
    public readonly user_id: Snowflake,
  ) {
    if (
      !attachment.name.endsWith('.png') &&
      !attachment.name.endsWith('.jpg') &&
      !attachment.name.endsWith('.jpeg')
    ) {
      throw new Error('Invalid file type. Only PNG, JPEG, and JPG files are allowed.');
    }

    if (attachment.size > 5e6) {
      throw new Error(
        `File size too large. Max file size is 5MB, but got ${attachment.size} bytes.`,
      );
    }

    const fileExtension = attachment.name.split('.').pop();
    const currentDate = new Date().toISOString().split('T')[0];
    this.renamed_file_name = `${currentDate}_${user_id}.${fileExtension}`;
  }

  public get path() {
    return this.renamed_file_name;
  }

  private async downloadFileBuffer(): Promise<Buffer> {
    const res = await fetch(this.attachment.url);

    if (!res.ok) {
      throw new Error(`Failed to fetch the file: ${res.statusText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  public async saveToFileSystem(): Promise<void> {
    try {
      const filePath = path.join(this.storage_directory_path, this.renamed_file_name);

      try {
        await fs.access(filePath);
        throw new Error(`File already exists: ${filePath}`);
      } catch (e) {
        if (e && typeof e === 'object' && 'code' in e && e.code !== 'ENOENT') {
          throw new Error(`Failed to access file: ${e}`);
        }

        if (
          e &&
          typeof e === 'object' &&
          'message' in e &&
          typeof e.message === 'string' &&
          e.message.startsWith('File already exists')
        ) {
          throw e;
        }

        const buffer = await this.downloadFileBuffer();
        await fs.writeFile(filePath, buffer);
        Logger.info(`File saved to ${filePath}`);
      }
    } catch (e) {
      throw new Error(`Failed to save file: ${e}`);
    }
  }
}
