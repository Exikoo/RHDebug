import { loadFiles } from "../Functions/fileLoader.js";
import { table } from "table";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import fs from "node:fs";

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
  MAX_ERROR_MESSAGE_LENGTH: 15,
  REQUIRED_COMMAND_PROPS: ["data", "execute"],
  REQUIRED_DATA_PROPS: ["name"],
  REGISTRATION_TIMEOUT: 15000,
  MAX_COMMAND_NAME_LENGTH: 32,
  MAX_COMMANDS: 100,
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
    { alignment: "center", width: 20 },
    { alignment: "right", width: 15 },
  ],
};

// Precompute the safe commands directory once
const COMMANDS_DIR = path.resolve(__dirname, "../Command");

// Where we remember the hash of the last set of commands we registered,
// so we can skip re-registering with Discord when nothing has changed.
const HASH_FILE = path.resolve(__dirname, "../data/commandsHash.json");

// ============================================================================
// COMMAND VALIDATION (unchanged, but kept for completeness)
// ============================================================================

function validateCommand(command) {
  if (!command || typeof command !== "object") {
    return { isValid: false, error: "Command must be an object" };
  }

  for (const prop of CONFIG.REQUIRED_COMMAND_PROPS) {
    if (!(prop in command)) {
      return { isValid: false, error: `Missing required property: ${prop}` };
    }
  }

  if (!command.data || typeof command.data !== "object") {
    return { isValid: false, error: "Command data must be an object" };
  }

  for (const prop of CONFIG.REQUIRED_DATA_PROPS) {
    if (!(prop in command.data)) {
      return {
        isValid: false,
        error: `Missing required data property: ${prop}`,
      };
    }
  }

  if (
    typeof command.data.name !== "string" ||
    command.data.name.trim() === ""
  ) {
    return { isValid: false, error: "Command name must be a non-empty string" };
  }

  if (command.data.name.length > CONFIG.MAX_COMMAND_NAME_LENGTH) {
    return {
      isValid: false,
      error: `Command name exceeds ${CONFIG.MAX_COMMAND_NAME_LENGTH} characters`,
    };
  }

  if (!/^[a-z0-9_-]+$/.test(command.data.name)) {
    return {
      isValid: false,
      error:
        "Command name must be lowercase alphanumeric with underscores/hyphens",
    };
  }

  if (typeof command.execute !== "function") {
    return { isValid: false, error: "Command execute must be a function" };
  }

  if (command.data.type !== undefined) {
    const validTypes = [1, 2, 3];
    if (!validTypes.includes(command.data.type)) {
      return {
        isValid: false,
        error: `Invalid command type: ${command.data.type}`,
      };
    }
  }

  if (!command.data.type || command.data.type === 1) {
    if (
      !command.data.description ||
      typeof command.data.description !== "string"
    ) {
      return {
        isValid: false,
        error: "CHAT_INPUT commands require a description",
      };
    }
  }

  if (typeof command.data.toJSON !== "function") {
    return { isValid: false, error: "Command data must have toJSON method" };
  }

  return { isValid: true };
}

// ============================================================================
// SAFE PATH CHECK (optimized)
// ============================================================================

function isPathSafe(resolvedPath) {
  return (
    resolvedPath === COMMANDS_DIR ||
    resolvedPath.startsWith(COMMANDS_DIR + path.sep)
  );
}

// ============================================================================
// SINGLE COMMAND LOADER
// Note: ESM has no require.resolve/require cache, and dynamic import() is
// always async, so this loader is now async where the CJS version was sync.
// ============================================================================

async function loadCommandFile(file, client) {
  try {
    const resolvedPath = path.resolve(file);

    if (!isPathSafe(resolvedPath)) {
      throw new Error("Invalid file path detected");
    }

    // Dynamic import replaces require(); Node caches by resolved URL so
    // re-importing the same path within one process reuses the instance.
    const commandModule = await import(pathToFileURL(resolvedPath).href);
    const command = commandModule.default ?? commandModule;

    const validation = validateCommand(command);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    client.commands.set(command.data.name, command);

    return {
      success: true,
      command,
      file,
      commandJSON: command.data.toJSON(),
    };
  } catch (error) {
    return {
      success: false,
      error,
      file,
    };
  }
}

// ============================================================================
// TABLE FORMATTING (unchanged)
// ============================================================================

function createTableHeader() {
  return [
    [
      `${COLORS.blue}${COLORS.bright}Command${COLORS.reset}`,
      `${COLORS.blue}${COLORS.bright}Status${COLORS.reset}`,
      `${COLORS.blue}${COLORS.bright}Type${COLORS.reset}`,
    ],
  ];
}

function addSuccessRow(tableData, command) {
  const typeStr = `${COLORS.cyan}${
    command.data.type ? `Type ${command.data.type}` : "Slash"
  }${COLORS.reset}`;

  tableData.push([
    `${COLORS.green}${command.data.name}${COLORS.reset}`,
    `${COLORS.bright}${COLORS.green}✓ LOADED${COLORS.reset}`,
    typeStr,
  ]);
}

function addErrorRow(tableData, file, error) {
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
// COMMAND REGISTRATION (unchanged)
// ============================================================================

async function registerCommands(client, commandsArray) {
  if (!client.application) {
    throw new Error(
      "Client application not available for command registration",
    );
  }

  if (commandsArray.length === 0) {
    console.warn(`${COLORS.yellow}No commands to register${COLORS.reset}`);
    return;
  }

  if (commandsArray.length > CONFIG.MAX_COMMANDS) {
    throw new Error(
      `Command count (${commandsArray.length}) exceeds maximum (${CONFIG.MAX_COMMANDS})`,
    );
  }

  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () =>
        reject(
          new Error(
            `Registration timeout after ${CONFIG.REGISTRATION_TIMEOUT}ms`,
          ),
        ),
      CONFIG.REGISTRATION_TIMEOUT,
    );
  });

  try {
    return await Promise.race([
      client.application.commands.set(commandsArray),
      timeoutPromise,
    ]);
  } finally {
    // Prevents a dangling timer from lingering for the rest of the timeout
    // duration once the race has already been decided.
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// LOGGING (unchanged)
// ============================================================================

function logSummary(successCount, errorCount, loadTime) {
  console.log(
    `${COLORS.blue}${COLORS.bright}» ${successCount} commands loaded successfully${COLORS.reset}`,
  );
  if (errorCount > 0) {
    console.log(
      `${COLORS.yellow}${COLORS.bright}» ${errorCount} commands failed to load${COLORS.reset}`,
    );
  }
  console.log(
    `${COLORS.cyan}⏱️  Loaded in ${loadTime.toFixed(2)}ms${COLORS.reset}\n`,
  );
}

function logCriticalError(error) {
  console.error(
    `${COLORS.red}${COLORS.bright}\n⚠️  Critical Error Loading Commands:${COLORS.reset}`,
  );
  console.error(`${COLORS.red}${error.stack || error.message}${COLORS.reset}`);
}

function logPartialFailure(successCount, errorCount, error) {
  console.warn(
    `${COLORS.yellow}${COLORS.bright}⚠️  Partial failure after loading ${successCount} commands${COLORS.reset}`,
  );
  console.warn(`${COLORS.yellow}${error.message}${COLORS.reset}`);
}

// ============================================================================
// MAIN FUNCTION (optimized)
// ============================================================================

async function loadCommands(client) {
  if (!client || typeof client !== "object") {
    throw new Error("Client must be a valid object");
  }

  if (!client.commands) {
    client.commands = new Map();
  } else if (!(client.commands instanceof Map)) {
    throw new Error("client.commands must be a Map instance");
  }

  if (!client.subCommands) {
    client.subCommands = new Map();
  } else if (!(client.subCommands instanceof Map)) {
    throw new Error("client.subCommands must be a Map instance");
  }

  const startTime = performance.now();
  let successCount = 0;
  let errorCount = 0;
  const commandsArray = [];

  try {
    const files = await loadFiles("Command");

    if (!Array.isArray(files)) {
      throw new Error("loadFiles must return an array");
    }

    if (files.length === 0) {
      console.warn(`${COLORS.yellow}No command files found${COLORS.reset}`);
      return;
    }

    console.log(
      `${COLORS.blue}Loading ${files.length} commands...${COLORS.reset}`,
    );

    const tableData = createTableHeader();

    // Concurrent loading – each file's dynamic import() is independent of
    // the others, so Promise.all lets them all resolve in parallel instead
    // of waiting on one file before starting the next. Order is preserved.
    const results = await Promise.all(
      files.map((file) => loadCommandFile(file, client)),
    );

    for (const result of results) {
      if (result.success) {
        addSuccessRow(tableData, result.command);
        commandsArray.push(result.commandJSON);
        successCount++;
      } else {
        addErrorRow(tableData, result.file, result.error);
        errorCount++;
      }
    }

    console.log(formatTable(tableData));

    // Register commands
    try {
      await registerCommands(client, commandsArray);
    } catch (registrationError) {
      logPartialFailure(successCount, errorCount, registrationError);
      const loadTime = performance.now() - startTime;
      logSummary(successCount, errorCount, loadTime);
      throw registrationError;
    }

    const loadTime = performance.now() - startTime;
    logSummary(successCount, errorCount, loadTime);
  } catch (error) {
    logCriticalError(error);
    throw error;
  }
}

export { loadCommands };
