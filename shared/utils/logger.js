const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../../logs');
const logFile = path.join(logDir, 'app.log');

const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'WARN' : 'DEBUG');

const LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Ensure logs directory exists
if (!fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (e) {
    // Ignore
  }
}

function writeLog(level, message, meta = {}) {
  if (LEVELS[level] > LEVELS[LOG_LEVEL]) return;

  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...meta
  };

  const logLine = JSON.stringify(logEntry);

  // 🔥 CPU WIN: ASYNC LOGGING & LEVEL FILTERING
  // In production, we mostly care about stdout (Docker handles it)
  // File logging is expensive (sync append).
  
  if (NODE_ENV === 'production' && level !== 'ERROR') {
    // Only console log for non-errors in prod
    console.log(logLine);
    return;
  }

  // Use setImmediate to offload the sync disk I/O from the main loop
  setImmediate(() => {
    try {
      fs.appendFileSync(logFile, logLine + '\n');
    } catch (err) {
      // Ignore
    }
  });

  console.log(logLine);
}

module.exports = {
  info: (msg, meta) => writeLog('INFO', msg, meta),
  error: (msg, meta) => writeLog('ERROR', msg, meta),
  warn: (msg, meta) => writeLog('WARN', msg, meta),
  debug: (msg, meta) => writeLog('DEBUG', msg, meta),
};

