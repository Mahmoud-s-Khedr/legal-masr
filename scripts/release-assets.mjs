#!/usr/bin/env node

import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(await readFile(join(repositoryRoot, "package.json"), "utf8"));
const tauriConfig = JSON.parse(await readFile(join(repositoryRoot, "src-tauri/tauri.conf.json"), "utf8"));
const cargoToml = await readFile(join(repositoryRoot, "src-tauri/Cargo.toml"), "utf8");

function applicationVersion() {
  const cargoMatch = cargoToml.match(/^version\s*=\s*"([^"]+)"/m);
  if (!cargoMatch) throw new Error("Could not read the package version from src-tauri/Cargo.toml.");
  const versions = [packageJson.version, tauriConfig.version, cargoMatch[1]];
  if (new Set(versions).size !== 1) {
    throw new Error(`Version mismatch: package.json=${versions[0]}, tauri.conf.json=${versions[1]}, Cargo.toml=${versions[2]}.`);
  }
  return versions[0];
}

async function filesRecursively(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesRecursively(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function verifyVersion(tag) {
  const version = applicationVersion();
  if (tag !== `v${version}`) throw new Error(`Release tag must be v${version}; received ${tag ?? "nothing"}.`);
  process.stdout.write(`Verified release tag ${tag} for application version ${version}.\n`);
}

async function stage(input, output) {
  if (!input || !output) throw new Error("stage requires --input <directory> and --output <directory>.");
  const version = applicationVersion();
  const files = await filesRecursively(input);
  const exes = files.filter((path) => path.toLowerCase().endsWith(".exe"));
  const dmgs = files.filter((path) => path.toLowerCase().endsWith(".dmg"));
  const intel = dmgs.find((path) => /x86_64-apple-darwin|macos-x64|intel/i.test(path));
  const arm = dmgs.find((path) => /aarch64-apple-darwin|macos-arm64|arm64|apple-silicon/i.test(path));
  if (exes.length !== 1 || dmgs.length !== 2 || !intel || !arm || intel === arm) {
    throw new Error(`Expected one NSIS .exe and distinct Intel/ARM DMGs; found ${exes.length} .exe and ${dmgs.length} .dmg (${dmgs.map((path) => basename(path)).join(", ")}).`);
  }

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  const artifacts = [
    [exes[0], `LegalMaster-Solo_${version}_windows_x64-setup.exe`],
    [intel, `LegalMaster-Solo_${version}_macos_x64.dmg`],
    [arm, `LegalMaster-Solo_${version}_macos_arm64.dmg`],
  ];
  for (const [source, name] of artifacts) await cp(source, join(output, name));
  for (const [, name] of artifacts) {
    if (!(await stat(join(output, name))).isFile()) throw new Error(`Expected staged artifact ${name} is missing.`);
  }
  const checksums = await Promise.all(artifacts.map(async ([, name]) => `${await sha256(join(output, name))}  ${name}`));
  await writeFile(join(output, "SHA256SUMS.txt"), `${checksums.join("\n")}\n`);
  process.stdout.write(`Staged ${artifacts.length} release artifacts for ${version}.\n`);
}

const [command, ...args] = process.argv.slice(2);
if (command === "verify-version" && args[0] === "--tag") await verifyVersion(args[1]);
else if (command === "stage") {
  const inputIndex = args.indexOf("--input");
  const outputIndex = args.indexOf("--output");
  await stage(inputIndex >= 0 ? args[inputIndex + 1] : undefined, outputIndex >= 0 ? args[outputIndex + 1] : undefined);
}
else throw new Error("Usage: release-assets.mjs verify-version --tag vX.Y.Z | stage --input <dir> --output <dir>");
