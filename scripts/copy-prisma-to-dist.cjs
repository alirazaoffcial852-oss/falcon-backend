"use strict";
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "../src/generated");
const destPrimary = path.join(__dirname, "../dist/generated");
const destSecondary = path.join(__dirname, "../dist/src/generated");

if (!fs.existsSync(src)) {
  console.warn("copy-prisma-to-dist: src/generated not found (run prisma generate first)");
  process.exit(0);
}

fs.mkdirSync(path.dirname(destPrimary), { recursive: true });
fs.cpSync(src, destPrimary, { recursive: true });

fs.mkdirSync(path.dirname(destSecondary), { recursive: true });
fs.cpSync(src, destSecondary, { recursive: true });

console.log(
  "copy-prisma-to-dist: copied src/generated -> dist/generated and dist/src/generated",
);
