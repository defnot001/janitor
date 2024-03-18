declare module 'bun' {
	interface Env {
		NODE_ENV: 'development' | 'production';
		DATABASE_URL: string;
		DISCORD_BOT_TOKEN: string;
		DISCORD_CLIENT_ID: string;
		ADMIN_SERVER_ID: string;
		ADMIN_SERVER_LOG_CHANNEL: string;
		ADMIN_SERVER_ERROR_LOG_CHANNEL: string;
		SUPERUSER: string;
	}
}
