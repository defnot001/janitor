import type { ClientEvents } from 'discord.js';

export class Event<K extends keyof ClientEvents> {
  constructor(
    public name: K,
    public execute: (...args: ClientEvents[K]) => void,
  ) {}
}
