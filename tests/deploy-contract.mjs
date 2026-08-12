#!/usr/bin/env node
/**
 * Deployment contract:
 * A Vault owns its plugin directory and runtime state. Deploy may update only
 * the three build-artifact links, never replace the directory or copy bundles.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const deployScript = fs.readFileSync(
  path.join(root, "scripts/deploy-obsidian-plugins.sh"),
  "utf8",
);

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

assert(
  /scripts\/deploy-obsidian-plugins\.sh/.test(packageJson.scripts.deploy ?? "") &&
    /scripts\/deploy-obsidian-plugins\.sh ai-manuscript-studio/.test(
      packageJson.scripts["deploy:ai-manuscript"] ?? "",
    ),
  "deploy commands must use the AI Manuscript Studio deploy helper",
);

assert(
  /OBSIDIAN_VAULT_PLUGINS_DIR is required/.test(deployScript),
  "deploy helper must require an explicit Vault plugin root",
);

assert(
  /for asset in main\.js manifest\.json styles\.css/.test(deployScript) &&
    /ln -s \"\$source\" \"\$temporary\"/.test(deployScript) &&
    /mv -f \"\$temporary\" \"\$destination\"/.test(deployScript),
  "deploy helper must atomically link only the three build artifacts",
);

assert(
  /Refusing to replace plugin-directory symlink/.test(deployScript) &&
    /Refusing to replace regular bundle file/.test(deployScript) &&
    !/INSTALL_ROOT/.test(deployScript) &&
    !/ln -sfn/.test(deployScript) &&
    !/\bcp\b/.test(deployScript),
  "deploy helper must preserve real Vault plugin directories and refuse bundle copies",
);

if (process.exitCode) process.exit(process.exitCode);
console.log("deploy contract OK");
