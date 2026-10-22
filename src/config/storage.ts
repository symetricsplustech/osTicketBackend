import fs from "fs";
import path from "path";
import { env } from "./env";

const baseDir = path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR);

function ensureBaseDir(): void {
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
}

export function resolveStoragePath(relativeKey: string): string {
  const normalised = path.normalize(relativeKey).replace(/^([/\\])+/, "");
  const absolute = path.resolve(baseDir, normalised);
  if (!absolute.startsWith(baseDir + path.sep) && absolute !== baseDir) {
    throw new Error("Invalid storage path: path traversal detected");
  }
  return absolute;
}

export const storage = {
  baseDir,

  ensureReady(): void {
    ensureBaseDir();
  },

  async writeFile(
    relativeKey: string,
    content: Buffer | string,
  ): Promise<string> {
    const absolute = resolveStoragePath(relativeKey);
    await fs.promises.mkdir(path.dirname(absolute), { recursive: true });
    await fs.promises.writeFile(absolute, content);
    return absolute;
  },

  async readFile(relativeKey: string): Promise<Buffer> {
    return fs.promises.readFile(resolveStoragePath(relativeKey));
  },

  createReadStream(relativeKey: string): fs.ReadStream {
    return fs.createReadStream(resolveStoragePath(relativeKey));
  },

  async deleteFile(relativeKey: string): Promise<void> {
    try {
      await fs.promises.unlink(resolveStoragePath(relativeKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  },

  async exists(relativeKey: string): Promise<boolean> {
    try {
      await fs.promises.access(
        resolveStoragePath(relativeKey),
        fs.constants.F_OK,
      );
      return true;
    } catch {
      return false;
    }
  },

  statSizeSync(): number {
    ensureBaseDir();
    let total = 0;
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else {
          try {
            total += fs.statSync(full).size;
          } catch {
            /* ignore unreadable files */
          }
        }
      }
    };
    try {
      walk(baseDir);
    } catch {
      return 0;
    }
    return total;
  },
};

storage.ensureReady();
