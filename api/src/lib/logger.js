const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

const CATEGORY_COLORS = {
  HEALTH: COLORS.green,
  AUTH: COLORS.cyan,
  JOBS: COLORS.blue,
  RIDERS: COLORS.magenta,
  USERS: COLORS.white,
  KYC: COLORS.yellow,
  WS: COLORS.magenta,
  STARTUP: COLORS.bright + COLORS.green,
};

function getCategory(method, path) {
  if (path === '/health') return 'HEALTH';
  if (path.startsWith('/auth')) return 'AUTH';
  if (path.startsWith('/jobs')) return 'JOBS';
  if (path.startsWith('/riders')) return 'RIDERS';
  if (path.startsWith('/users')) return 'USERS';
  if (path.startsWith('/kyc')) return 'KYC';
  return 'API';
}

function getStatusColor(status) {
  if (status >= 500) return COLORS.red;
  if (status >= 400) return COLORS.yellow;
  if (status >= 300) return COLORS.cyan;
  return COLORS.green;
}

function formatTime(ms) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function logger(req, res, next) {
  const start = Date.now();
  const { method, originalUrl } = req;

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    res._responseBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const category = getCategory(method, originalUrl);
    const catColor = CATEGORY_COLORS[category] || COLORS.white;
    const statusColor = getStatusColor(status);

    const timestamp = new Date().toISOString().slice(11, 23);
    const statusStr = `${statusColor}${status}${COLORS.reset}`;
    const methodStr = `${COLORS.bright}${method}${COLORS.reset}`;
    const catStr = `${catColor}[${category}]${COLORS.reset}`;
    const timeStr = `${COLORS.gray}${formatTime(duration)}${COLORS.reset}`;
    const pathStr = `${COLORS.white}${originalUrl}${COLORS.reset}`;

    console.log(`${COLORS.gray}${timestamp}${COLORS.reset} ${catStr} ${statusStr} ${methodStr} ${pathStr} ${COLORS.dim}-${COLORS.reset} ${timeStr}`);
  });

  next();
}

function logStartup(message) {
  const timestamp = new Date().toISOString().slice(11, 23);
  console.log(`${COLORS.gray}${timestamp}${COLORS.reset} ${CATEGORY_COLORS.STARTUP}[STARTUP]${COLORS.reset} ${COLORS.bright}${COLORS.green}${message}${COLORS.reset}`);
}

function logRedis(message, connected = true) {
  const timestamp = new Date().toISOString().slice(11, 23);
  const color = connected ? COLORS.green : COLORS.yellow;
  const status = connected ? 'CONNECTED' : 'SKIPPED';
  console.log(`${COLORS.gray}${timestamp}${COLORS.reset} ${CATEGORY_COLORS.WS}[REDIS]${COLORS.reset} ${color}${status}${COLORS.reset} ${COLORS.dim}${message}${COLORS.reset}`);
}

function logDB(message, ok = true) {
  const timestamp = new Date().toISOString().slice(11, 23);
  const color = ok ? COLORS.green : COLORS.red;
  const status = ok ? 'OK' : 'ERROR';
  console.log(`${COLORS.gray}${timestamp}${COLORS.reset} ${COLORS.cyan}[DATABASE]${COLORS.reset} ${color}${status}${COLORS.reset} ${COLORS.dim}${message}${COLORS.reset}`);
}

module.exports = { logger, logStartup, logRedis, logDB, COLORS };
