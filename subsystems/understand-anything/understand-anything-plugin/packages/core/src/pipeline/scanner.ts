import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createIgnoreFilter } from "../ignore-filter.js";
import { resolveUaDir } from "../persistence/index.js";
import { LanguageRegistry } from "../languages/language-registry.js";
import { FrameworkRegistry } from "../languages/framework-registry.js";

export type FileCategory =
  | "code"
  | "config"
  | "docs"
  | "infra"
  | "data"
  | "script"
  | "markup";

export interface ScannedFileInfo {
  path: string; // POSIX relative path
  language: string;
  sizeLines: number;
  fileCategory: FileCategory;
}

export interface ScanResult {
  projectName: string;
  projectDescription?: string;
  languages: string[];
  frameworks: string[];
  files: ScannedFileInfo[];
  totalFiles: number;
  filteredByIgnore: number;
  estimatedComplexity: "small" | "moderate" | "large" | "very-large";
  stats: {
    filesScanned: number;
    byCategory: Record<FileCategory, number>;
    byLanguage: Record<string, number>;
  };
}

export interface ScannerOptions {
  excludePatterns?: string[];
  maxFiles?: number;
}

/**
 * Deterministic file scanner and classification engine.
 * Discovers project files, detects languages/frameworks, computes line counts,
 * and classifies files into architectural categories.
 */
export class ProjectScanner {
  private readonly projectRoot: string;
  private readonly languageRegistry: LanguageRegistry;
  private readonly frameworkRegistry: FrameworkRegistry;

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
    this.languageRegistry = LanguageRegistry.createDefault();
    this.frameworkRegistry = FrameworkRegistry.createDefault();
  }

  /**
   * Scans the project directory.
   */
  scan(options: ScannerOptions = {}): ScanResult {
    const rawFiles = this.enumerateFiles();
    const ignoreFilter = createIgnoreFilter(this.projectRoot, options.excludePatterns);

    let filteredByIgnore = 0;
    const acceptedFiles: string[] = [];

    for (const relPath of rawFiles) {
      if (ignoreFilter.isIgnored(relPath)) {
        filteredByIgnore++;
      } else {
        acceptedFiles.push(relPath);
      }
    }

    const files: ScannedFileInfo[] = [];
    const byCategory: Record<FileCategory, number> = {
      code: 0,
      config: 0,
      docs: 0,
      infra: 0,
      data: 0,
      script: 0,
      markup: 0,
    };
    const byLanguage: Record<string, number> = {};

    for (const relPath of acceptedFiles) {
      const fullPath = path.join(this.projectRoot, relPath);
      let sizeLines = 0;
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        // Count lines
        sizeLines = content.split("\n").length;
      } catch {
        // Unreadable / binary file: skip
        continue;
      }

      const language = this.detectLanguage(relPath);
      const fileCategory = this.detectCategory(relPath, language);

      files.push({
        path: relPath,
        language,
        sizeLines,
        fileCategory,
      });

      byCategory[fileCategory] = (byCategory[fileCategory] || 0) + 1;
      byLanguage[language] = (byLanguage[language] || 0) + 1;
    }

    // Sort deterministically by UTF-16 code-unit
    files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

    const languages = Object.keys(byLanguage).sort();
    const frameworks = this.detectFrameworks(files);

    const totalFiles = files.length;
    let estimatedComplexity: ScanResult["estimatedComplexity"] = "small";
    if (totalFiles > 500) estimatedComplexity = "very-large";
    else if (totalFiles > 150) estimatedComplexity = "large";
    else if (totalFiles > 50) estimatedComplexity = "moderate";

    const projectName = path.basename(this.projectRoot);

    return {
      projectName,
      languages,
      frameworks,
      files,
      totalFiles,
      filteredByIgnore,
      estimatedComplexity,
      stats: {
        filesScanned: acceptedFiles.length,
        byCategory,
        byLanguage,
      },
    };
  }

  private enumerateFiles(): string[] {
    // Try git ls-files first for speed & accuracy
    const gitResult = spawnSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: this.projectRoot, encoding: "buffer" },
    );

    if (gitResult.status === 0 && gitResult.stdout && gitResult.stdout.length > 0) {
      const paths = gitResult.stdout
        .toString("utf-8")
        .split("\0")
        .filter(Boolean)
        .map((p) => p.split(path.sep).join("/"));
      return paths;
    }

    // Fallback: recursive directory walk
    const results: string[] = [];
    const walk = (dir: string, prefix: string) => {
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walk(path.join(dir, entry.name), rel);
        } else if (entry.isFile()) {
          results.push(rel);
        }
      }
    };

    walk(this.projectRoot, "");
    return results;
  }

  private detectLanguage(relPath: string): string {
    const lang = this.languageRegistry.getForFile(relPath);
    return lang ? lang.id : "plaintext";
  }

  private detectCategory(relPath: string, language: string): FileCategory {
    const lower = relPath.toLowerCase();
    const base = path.basename(lower);

    // Infra
    if (
      lower.startsWith(".github/") ||
      lower.startsWith("docker/") ||
      base === "dockerfile" ||
      base.startsWith("dockerfile.") ||
      base === "docker-compose.yml" ||
      base === "docker-compose.yaml" ||
      lower.endsWith(".tf") ||
      lower.endsWith(".k8s.yaml") ||
      lower.endsWith(".k8s.yml")
    ) {
      return "infra";
    }

    // Docs
    if (
      lower.startsWith("docs/") ||
      lower.startsWith("documentation/") ||
      base.startsWith("readme") ||
      base.startsWith("contributing") ||
      base.startsWith("changelog") ||
      base.startsWith("license") ||
      lower.endsWith(".md") ||
      lower.endsWith(".rst") ||
      lower.endsWith(".txt")
    ) {
      return "docs";
    }

    // Config
    if (
      base.startsWith("tsconfig") ||
      base.startsWith(".eslint") ||
      base.startsWith("eslint.config") ||
      base.startsWith("vite.config") ||
      base.startsWith("vitest.config") ||
      base.startsWith("astro.config") ||
      base.startsWith("tailwind.config") ||
      base === "package.json" ||
      base === "pnpm-workspace.yaml" ||
      base === "cargo.toml" ||
      base === "go.mod" ||
      base.startsWith(".env") ||
      lower.endsWith(".json") ||
      lower.endsWith(".yaml") ||
      lower.endsWith(".yml") ||
      lower.endsWith(".toml")
    ) {
      return "config";
    }

    // Script
    if (
      lower.startsWith("scripts/") ||
      lower.endsWith(".sh") ||
      lower.endsWith(".bash") ||
      lower.endsWith(".ps1")
    ) {
      return "script";
    }

    // Markup
    if (lower.endsWith(".html") || lower.endsWith(".css") || lower.endsWith(".svg")) {
      return "markup";
    }

    // Code
    return "code";
  }

  private detectFrameworks(files: ScannedFileInfo[]): string[] {
    const matched = new Set<string>();
    const filePaths = files.map((f) => f.path);

    for (const fw of this.frameworkRegistry.getAllFrameworks()) {
      const patterns = [...(fw.manifestFiles || []), ...(fw.entryPoints || [])];
      for (const pattern of patterns) {
        if (typeof pattern === "string") {
          if (filePaths.some((p) => p.includes(pattern))) {
            matched.add(fw.displayName || fw.id);
            break;
          }
        }
      }
    }

    return Array.from(matched).sort();
  }
}
