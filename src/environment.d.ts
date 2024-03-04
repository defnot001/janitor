declare module 'bun' {
  interface Env {
    NODE_ENV: 'development' | 'production';
    DISCORD_BOT_TOKEN: string;
    DISCORD_CLIENT_ID: string;
    ADMIN_SERVER_ID: string;
  }
}
