import fs from "node:fs";
import path from "node:path";

// Workaround for a Parcel Windows build crash:
// @parcel/fs has a writeStream error handler that calls unlinkSync(tmpFilePath)
// without guarding ENOENT. On some Windows setups, the temp file is already gone,
// and unlinkSync throws, crashing the build process.
//
// This patch makes the unlink best-effort (ignore ENOENT and any unlink errors).
//
// Safe to run multiple times.

const target = path.join(
  process.cwd(),
  "node_modules",
  "@parcel",
  "fs",
  "lib",
  "index.js"
);

if (!fs.existsSync(target)) {
  console.warn(`[patch_parcel_fs] Skipping: not found: ${target}`);
  process.exit(0);
}

const src = fs.readFileSync(target, "utf8");

const marker = "/* morrowfold-patch: ignore unlink errors */";
const originalCall =
  "(0, (/*@__PURE__*/$parcel$interopDefault($07c33d31980d7367$exports))).unlinkSync(tmpFilePath);";

const patchedBlock = `${marker}\n            try {\n                ${originalCall}\n            } catch (_) {}`;

let out = src;

// Fix previously broken patch state (older versions of this script).
out = out.replace(
  /\(0, \(\/\*@__PURE__\*\/\$parcel\$interopDefault\(\$07c33d31980d7367\$exports\)\)\)\)\.\/* morrowfold-patch: ignore unlink errors \*\/\s*\r?\n\s*try \{ \(0, \(\/\*@__PURE__\*\/\$parcel\$interopDefault\(\$07c33d31980d7367\$exports\)\)\)\)\.unlinkSync\(tmpFilePath\); \} catch \(_\) \{\}/g,
  patchedBlock
);

if (out.includes(marker)) {
  // Ensure we didn't miss the original call if the file already had a correct patch.
  fs.writeFileSync(target, out, "utf8");
  console.log("[patch_parcel_fs] Already patched.");
  process.exit(0);
}

if (!out.includes(originalCall)) {
  console.warn("[patch_parcel_fs] Skipping: expected call pattern not found.");
  process.exit(0);
}

out = out.replace(originalCall, patchedBlock);

fs.writeFileSync(target, out, "utf8");
console.log("[patch_parcel_fs] Patched @parcel/fs unlinkSync to be best-effort.");

