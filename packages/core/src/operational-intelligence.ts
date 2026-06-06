/**
 * Compatibility barrel for operational-intelligence contracts.
 * P7-S13.5: All symbols are now implemented in ./operational-intelligence/
 * and re-exported here to preserve all existing import paths.
 *
 * Consumers that import from "./operational-intelligence.js" or
 * "@flowdesk/core" continue to receive the same exported API.
 */
export * from "./operational-intelligence/index.js";
