import { loadFiles } from "../Functions/fileLoader.js";
import { table } from "table";
import { performance } from "node:perf_hooks";
import path from "node:path";
import EventEmitter from "node:events";
import { fileURLToPath, pathToFileURL } from "node:url";

// ============================================================================
// ESM equivalents of __filename / __dirname (not available by default in ESM)
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONSTANTS & CONFIGURATION (unchanged)
// ============================================================================

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
  cyan: "\x1b[36m",
};

const CONFIG = {
  MAX_ERROR_MESSAGE_LENGTH: 20,
  REQUIRED_EVENT_PROPS: ["name", "execute"],
  MAX_EVENT_LISTENERS: 10,
};

const TABLE_CONFIG = {
  border: {
    topBody: "─",
    topJoin: "┬",
    topLeft: "╭",
    topRight: "╮",
    bottomBody: "─",
    bottomJoin: "┴",
    bottomLeft: "╰",
    bottomRight: "╯",
    bodyLeft: "│",
    bodyRight: "│",
    bodyJoin: "│",
    joinBody: "─",
    joinLeft: "├",
    joinRight: "┤",
    joinJoin: "┼",
  },
  columns: [
    { alignment: "left", width: 25 },
    { alignment: "center", width: 15 },
    { alignment: "right", width: 20 },
  ],
};

// Precompute the safe events directory once
const EVENTS_DIR = path.resolve(__dirname, "../Events");

// ============================================================================
// EVENT VALIDATION (unchanged)
// ============================================================================

function validateEvent(event) {
  if (!event || typeof event !== "object") {
    return { isValid: false, error: "Event must be an object" };
  }

  for (const prop of CONFIG.REQUIRED_EVENT_PROPS) {
    if (!(prop in event)) {
      return { isValid: false, error: `Missing required property: ${prop}` };
    }
  }

  if (typeof event.name !== "string" || event.name.trim() === "") {
    return { isValid: false, error: "Event name must be a non-empty string" };
  }

  if (typeof event.execute !== "function") {
    return { isValid: false, error: "Event execute must be a function" };
  }

  if (event.rest !== undefined && typeof event.rest !== "boolean") {
    return { isValid: false, error: "Event rest must be boolean" };
  }

  if (event.once !== undefined && typeof event.once !== "boolean") {
    return { isValid: false, error: "Event once must be boolean" };
  }

  return { isValid: true };
}

// ============================================================================
// SAFE PATH CHECK (optimized)
// ============================================================================

function isPathSafe(resolvedPath) {
  return (
    resolvedPath === EVENTS_DIR ||
    resolvedPath.startsWith(EVENTS_DIR + path.sep)
  );
}

// ============================================================================
// WRAPPED EXECUTOR (unchanged)
// ============================================================================

function createWrappedExecutor(event, client) {
  return async (...args) => {
    try {
      return await event.execute(...args, client);
    } catch (error) {
      console.error(
        `${COLORS.red}Event ${event.name} execution error:${COLORS.reset}`,
        error,
      );
      throw error;
    }
  };
}

// ============================================================================
// EVENT REGISTRATION (unchanged)
// ============================================================================

function registerEventListener(client, event, executor) {
  const target = event.rest ? client.rest : client;

  if (!(target instanceof EventEmitter)) {
    throw new Error(
      `Invalid target for event ${event.name}: must be EventEmitter`,
    );
  }

  const listenerCount = target.listenerCount(event.name);
  if (listenerCount >= CONFIG.MAX_EVENT_LISTENERS) {
    console.warn(
      `${COLORS.yellow}Warning: Max listeners reached for ${event.name}${COLORS.reset}`,
    );
  }

  target.setMaxListeners(Math.max(target.getMaxListeners(), listenerCount + 1));

  const method = event.once ? "once" : "on";
  target[method](event.name, executor);
}

// ============================================================================
// SINGLE EVENT LOADER
// Note: ESM has no require.resolve/require cache, and dynamic import() is
// always async, so this loader is now async where the CJS version was sync.
// ============================================================================

async function loadEventFile(file, client) {
  try {
    const resolvedPath = path.resolve(file);

    if (!isPathSafe(resolvedPath)) {
      throw new Error("Invalid file path detected");
    }

    // Dynamic import replaces require(); ESM has no built-in require cache,
    // so re-importing the same path within one process reuses the module
    // instance automatically (Node caches by resolved URL).
    const eventModule = await import(pathToFileURL(resolvedPath).href);
    const event = eventModule.default ?? eventModule;

    const validation = validateEvent(event);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const wrappedExecute = createWrappedExecutor(event, client);
    registerEventListener(client, event, wrappedExecute);

    // Keyed by filename (not event.name) so multiple files that listen for
    // the same Discord event (e.g. two interactionCreate handlers) each get
    // their own entry instead of overwriting one another in the map.
    const key = path.basename(file, path.extname(file));

    client.events.set(key, {
      eventName: event.name,
      executor: wrappedExecute,
      metadata: {
        filePath: file,
        isREST: event.rest || false,
        isOnce: event.once || false,
        loadTime: Date.now(),
      },
    });

    return { success: true, event, file };
  } catch (error) {
    return { success: false, error, file };
  }
}

// ============================================================================
// TABLE FORMATTING (unchanged)
// ============================================================================

function createTableHeader() {
  return [
    [
      `${COLORS.blue}${COLORS.bright}Event${COLORS.reset}`,
      `${COLORS.blue}${COLORS.bright}Status${COLORS.reset}`,
      `${COLORS.blue}${COLORS.bright}Type${COLORS.reset}`,
    ],
  ];
}

function addSuccessRow(tableData, event) {
  const typeStr = `${COLORS.gray}${event.rest ? "REST" : "CLIENT"}${
    event.once ? " (ONCE)" : ""
  }${COLORS.reset}`;

  tableData.push([
    `${COLORS.green}${event.name}${COLORS.reset}`,
    `${COLORS.bright}${COLORS.green}✓ LOADED${COLORS.reset}`,
    typeStr,
  ]);
}

function addErrorRow(tableData, file, error) {
  console.log(error);
  const fileName = path.basename(file);
  const errorMsg =
    error.message.length > CONFIG.MAX_ERROR_MESSAGE_LENGTH
      ? `${error.message.substring(0, CONFIG.MAX_ERROR_MESSAGE_LENGTH)}...`
      : error.message;

  tableData.push([
    `${COLORS.red}${fileName}${COLORS.reset}`,
    `${COLORS.bright}${COLORS.red}✗ FAILED${COLORS.reset}`,
    `${COLORS.yellow}${errorMsg}${COLORS.reset}`,
  ]);
}

function formatTable(tableData) {
  return table(tableData, TABLE_CONFIG);
}

// ============================================================================
// LOGGING (unchanged)
// ============================================================================

function logSummary(successCount, errorCount, loadTime) {
  console.log(
    `${COLORS.blue}${COLORS.bright}» ${successCount} events loaded successfully${COLORS.reset}`,
  );
  if (errorCount > 0) {
    console.log(
      `${COLORS.yellow}${COLORS.bright}» ${errorCount} events failed to load${COLORS.reset}`,
    );
  }
  console.log(
    `${COLORS.cyan}⏱️  Loaded in ${loadTime.toFixed(2)}ms${COLORS.reset}\n`,
  );
}

function logCriticalError(error) {
  console.log(error);
  console.error(
    `${COLORS.red}${COLORS.bright}\n⚠️  Critical Error Loading Events:${COLORS.reset}`,
  );
  console.error(`${COLORS.red}${error.stack || error.message}${COLORS.reset}`);
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function loadEvents(client) {
  if (!client || typeof client !== "object") {
    throw new Error("Client must be a valid object");
  }

  if (!client.events) {
    client.events = new Map();
  } else if (!(client.events instanceof Map)) {
    throw new Error("client.events must be a Map instance");
  }

  const startTime = performance.now();
  let successCount = 0;
  let errorCount = 0;

  try {
    const files = await loadFiles("Events");

    if (!Array.isArray(files)) {
      throw new Error("loadFiles must return an array");
    }

    if (files.length === 0) {
      console.warn(`${COLORS.yellow}No event files found${COLORS.reset}`);
      return;
    }

    console.log(
      `${COLORS.blue}Loading ${files.length} events...${COLORS.reset}`,
    );

    const tableData = createTableHeader();

    // Concurrent loading – each file's dynamic import() is independent of
    // the others, so Promise.all lets them all resolve in parallel instead
    // of waiting on one file before starting the next. Order is preserved.
    const results = await Promise.all(
      files.map((file) => loadEventFile(file, client)),
    );

    for (const result of results) {
      if (result.success) {
        addSuccessRow(tableData, result.event);
        successCount++;
      } else {
        addErrorRow(tableData, result.file, result.error);
        errorCount++;
      }
    }

    console.log(formatTable(tableData));

    const loadTime = performance.now() - startTime;
    logSummary(successCount, errorCount, loadTime);
  } catch (error) {
    logCriticalError(error);
    throw error;
  }
}

export { loadEvents };
