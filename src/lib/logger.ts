type LogLevel = "debug" | "info" | "warn" | "error";

function write(level: LogLevel, message: string, fields?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") {
    console.error(line);
  } else if (process.env.NODE_ENV === "production") {
    // Info/debug noise stays out of the production console.
    return;
  } else {
    console.debug(line);
  }
}

/**
 * Structured JSON logger.
 * NEVER log passwords, API keys, tokens or sensitive user data.
 */
export const logger = {
  debug: (message: string, fields?: Record<string, unknown>) => write("debug", message, fields),
  info: (message: string, fields?: Record<string, unknown>) => write("info", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => write("warn", message, fields),
  error: (message: string, fields?: Record<string, unknown>) => write("error", message, fields),
};
