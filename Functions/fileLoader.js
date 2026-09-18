import { glob } from "glob";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fileCache = new Map();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// fileLoader.js lives in Functions/, so project root is one level up.
const PROJECT_ROOT = path.resolve(__dirname, "..").replace(/\\/g, "/");

export async function loadFiles(dirName) {
  if (fileCache.has(dirName)) return fileCache.get(dirName);

  const loadPromise = (async () => {
    const pattern = `${PROJECT_ROOT}/${dirName}/**/*.{js,mjs,cjs}`;
    const files = await glob(pattern, {
      absolute: true,
      ignore: ["**/node_modules/**", "**/.git/**"],
      followSymbolicLinks: false,
    });

    // Files whose basename starts with "_" are sub-modules (helpers imported
    // by real event/command files), not loadable events/commands themselves.
    return files.filter((file) => !path.basename(file).startsWith("_"));
  })().catch((error) => {
    fileCache.delete(dirName); // don't leave a failed scan cached — allow retry
    throw new Error(`Failed to load files from ${dirName}: ${error.message}`, {
      cause: error,
    });
  });

  fileCache.set(dirName, loadPromise);
  return loadPromise;
}

export function clearCache(dirName) {
  fileCache.delete(dirName);
}
