export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const colors = {
  reset: '\x1b[0m',
  debug: '\x1b[36m', // Cyan for better visibility
  info: '\x1b[34m', // Blue
  warn: '\x1b[33m', // Yellow
  error: '\x1b[31m', // Red
};

export default abstract class Logger {
  public static debug(message: string): void {
    this.log(message, 'debug');
  }

  public static info(message: string): void {
    this.log(message, 'info');
  }

  public static warn(message: string): void {
    this.log(message, 'warn');
  }

  public static error(message: string): void {
    this.log(message, 'error');
  }

  private static log(message: string, logLevel: LogLevel): void {
    const now = new Date();
    const timeString = `[${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}] [${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')}]`;
    const logLevelString = `${this.displayLogLevel(logLevel)}:`;
    const coloredPrefix = `${colors[logLevel]}${timeString} ${logLevelString}${colors.reset}`;

    console.log(`${coloredPrefix} ${message}`);
  }

  private static displayLogLevel(logLevel: LogLevel): string {
    switch (logLevel) {
      case 'debug':
        return 'DEBUG';
      case 'info':
        return 'INFO';
      case 'warn':
        return 'WARN';
      case 'error':
        return 'ERROR';
      default:
        return 'UNKNOWN'; // Fallback case
    }
  }
}
