"use strict";
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "../src/generated");
const dest = path.join(__dirname, "../dist/generated");

if (!fs.existsSync(src)) {
  console.warn("copy-prisma-to-dist: src/generated not found (run prisma generate first)");
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log("copy-prisma-to-dist: copied src/generated -> dist/generated");
