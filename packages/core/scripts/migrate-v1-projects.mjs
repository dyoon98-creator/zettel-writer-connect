#!/usr/bin/env node
// migrate-v1-projects.mjs — 일회성 디스크 도구.
// `<vault>/3 Writing/` 아래에 있는 v1 단일 .md 들을 찾아 v2 폴더 구조로
// 변환한다. 이 스크립트는 VaultAdapter 추상화를 거치지 않고 fs 를 직접 사용한다.
//
// Usage:
//   node packages/core/scripts/migrate-v1-projects.mjs <vault-path> [--dry-run]

import { promises as fs } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  console.log(
    "Usage: node migrate-v1-projects.mjs <vault-path> [--dry-run]",
  );
  process.exit(0);
}

const vaultPath = args[0];
const dryRun = args.includes("--dry-run");

const writingRoot = path.join(vaultPath, "3 Writing");

async function dirExists(p) {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function listFilesShallow(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}

function extractFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const obj = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    obj[k] = v;
  }
  return obj;
}

async function main() {
  if (!(await dirExists(writingRoot))) {
    console.log(`[migrate] 3 Writing 폴더가 없습니다: ${writingRoot}`);
    console.log("[migrate] 처리할 v1 프로젝트가 없어 종료합니다.");
    process.exit(0);
  }
  const candidates = await listFilesShallow(writingRoot);
  if (candidates.length === 0) {
    console.log(
      `[migrate] ${writingRoot} 안에 마이그레이션할 v1 .md 파일이 없습니다.`,
    );
    process.exit(0);
  }

  // core 모듈을 import 해서 migrate 함수 사용. ESM tsc 빌드 경로(dist) 가정.
  const corePath = path.resolve(
    new URL("..", import.meta.url).pathname,
    "dist",
    "migrate",
    "v1ToV2.js",
  );
  let migrate;
  try {
    ({ migrate } = await import(corePath));
  } catch (err) {
    console.error(
      `[migrate] core dist 빌드를 찾을 수 없습니다 (${corePath}). 'pnpm -r build' 실행 후 다시 시도하세요.`,
    );
    console.error(err.message);
    process.exit(1);
  }

  // 가벼운 fs 기반 어댑터 — VaultAdapter 인터페이스만 충족
  const adapter = {
    async readFile(rel) {
      return fs.readFile(path.join(vaultPath, rel), "utf8");
    },
    async writeFile(rel, content) {
      const abs = path.join(vaultPath, rel);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content, "utf8");
    },
    async fileExists(rel) {
      try {
        await fs.access(path.join(vaultPath, rel));
        return true;
      } catch {
        return false;
      }
    },
    async listDir(rel) {
      const abs = path.join(vaultPath, rel);
      try {
        const entries = await fs.readdir(abs, { withFileTypes: true });
        return entries.map((e) => ({
          name: e.name,
          isDirectory: e.isDirectory(),
        }));
      } catch {
        return [];
      }
    },
    async ensureDir(rel) {
      await fs.mkdir(path.join(vaultPath, rel), { recursive: true });
    },
    async deleteFile(rel) {
      try {
        await fs.unlink(path.join(vaultPath, rel));
      } catch {
        /* swallow */
      }
    },
    watch() {
      return () => undefined;
    },
    getBasePath() {
      return vaultPath;
    },
  };

  let migrated = 0;
  for (const abs of candidates) {
    const relOldPath = path.relative(vaultPath, abs);
    const raw = await fs.readFile(abs, "utf8");
    const fm = extractFrontmatter(raw);
    if (!fm || fm.type !== "writing") continue;
    const slug = path
      .basename(abs, ".md")
      .replace(/^\d+_/, "")
      .replace(/\s+/g, "-");
    const newFolderRel = `3 Writing/${slug}`;
    console.log(
      `[migrate]${dryRun ? " (dry-run)" : ""} ${relOldPath} → ${newFolderRel}`,
    );
    const report = await migrate(adapter, relOldPath, newFolderRel, {
      dryRun,
    });
    console.log(
      `  - 장면 ${report.scenesCreated}개, 파일 ${report.filesCreated.length}개${
        report.originalBackupPath
          ? `, 백업 ${report.originalBackupPath}`
          : ""
      }`,
    );
    if (report.warnings.length > 0) {
      for (const w of report.warnings) console.log(`  ! ${w}`);
    }
    migrated += 1;
  }
  console.log(
    `[migrate] 완료. 처리된 프로젝트: ${migrated}개${dryRun ? " (dry-run)" : ""}`,
  );
}

main().catch((err) => {
  console.error("[migrate] 실패:", err);
  process.exit(1);
});
