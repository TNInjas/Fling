import path from "node:path";
import fs from "node:fs";

/**
 * Validates and enforces that file paths remain safely contained inside
 * a specified project root directory. Prevents directory traversal,
 * escape via symlinks, and absolute path leakage.
 */
export class PathValidator {
  private readonly projectRoot: string;

  constructor(projectRoot: string) {
    if (!projectRoot) {
      throw new Error("PathValidator requires a non-empty projectRoot");
    }
    const resolved = path.resolve(projectRoot);
    this.projectRoot = fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved;
  }

  /**
   * Returns the canonical absolute path of project root.
   */
  getProjectRoot(): string {
    return this.projectRoot;
  }

  /**
   * Asserts that a target path is strictly within the project root.
   * Throws an Error if the path escapes the root (e.g. via ../ or external symlink).
   *
   * @param targetPath Relative or absolute path to validate
   * @returns Normalized path relative to projectRoot (using POSIX forward slashes)
   */
  assertInsideRoot(targetPath: string): string {
    if (typeof targetPath !== "string" || targetPath.trim().length === 0) {
      throw new Error("Path cannot be empty");
    }

    // Check for null byte injection
    if (targetPath.includes("\0")) {
      throw new Error(`Security Violation: Path contains null bytes: '${targetPath}'`);
    }

    const resolved = path.isAbsolute(targetPath)
      ? path.resolve(targetPath)
      : path.resolve(this.projectRoot, targetPath);

    const realTarget = fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved;

    const rootWithSep = this.projectRoot.endsWith(path.sep)
      ? this.projectRoot
      : this.projectRoot + path.sep;

    if (realTarget !== this.projectRoot && !realTarget.startsWith(rootWithSep)) {
      throw new Error(
        `Security Violation: Path '${targetPath}' resolves outside project boundary '${this.projectRoot}'`,
      );
    }

    const relativePath = path.relative(this.projectRoot, realTarget);
    // Convert to POSIX forward slashes for consistent graph IDs across platforms
    return relativePath.split(path.sep).join("/");
  }

  /**
   * Checks if a target path is inside the project root without throwing.
   */
  isInsideRoot(targetPath: string): boolean {
    try {
      this.assertInsideRoot(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Safely sanitizes a path: if inside project root, returns relative path;
   * if outside or invalid, falls back to basename to prevent leaking host directory structures.
   */
  sanitizePath(targetPath: string): string {
    try {
      return this.assertInsideRoot(targetPath);
    } catch {
      return path.basename(targetPath);
    }
  }
}
