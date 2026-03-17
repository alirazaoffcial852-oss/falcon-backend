"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIdParam = parseIdParam;
/** Parse route param id to number. Returns null if invalid. */
function parseIdParam(id) {
    if (id == null)
        return null;
    const s = Array.isArray(id) ? id[0] : id;
    if (s == null)
        return null;
    const n = parseInt(String(s), 10);
    if (Number.isNaN(n) || n < 1)
        return null;
    return n;
}
