import { CommandOptions } from '../types';

export class Command {
  constructor(commandOptions: CommandOptions) {
    Object.assign(this, commandOptions);
  }
}
