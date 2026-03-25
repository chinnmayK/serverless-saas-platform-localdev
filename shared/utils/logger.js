const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../../logs');
const logFile = path.join(logDir, 'app.log');

// Ensure logs directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function writeLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();

  const logEntry = {
    timestamp,
    level,
    message,
    ...meta
  };

  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  console.log(JSON.stringify(logEntry));
}

// Export helper methods
module.exports = {
  info: (msg, meta) => writeLog('INFO', msg, meta),
  error: (msg, meta) => writeLog('ERROR', msg, meta),
  warn: (msg, meta) => writeLog('WARN', msg, meta),
  debug: (msg, meta) => writeLog('DEBUG', msg, meta),
};
