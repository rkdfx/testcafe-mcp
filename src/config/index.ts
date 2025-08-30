/**
 * Configuration module exports
 */

export {
  ConfigManager,
  BrowserConfigSchema,
  TestCafeConfigSchema,
  ServerConfigSchema,
  ConfigSchema
} from './config-manager.js';

export type {
  BrowserConfig,
  TestCafeConfig,
  ServerConfig,
  Config
} from './config-manager.js';