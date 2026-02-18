/**
 * Configuration Management System
 * 
 * Handles configuration validation and management for TestCafe and server settings.
 */

import { z } from 'zod';

/**
 * Browser configuration schema
 */
export const BrowserConfigSchema = z.object({
  name: z.enum(['chrome', 'firefox', 'safari', 'edge']),
  headless: z.boolean().default(true),
  args: z.array(z.string()).default([]),
  viewport: z.object({
    width: z.number().min(320).max(3840).default(1920),
    height: z.number().min(240).max(2160).default(1080)
  }).optional()
});

/**
 * TestCafe configuration schema
 */
export const TestCafeConfigSchema = z.object({
  browsers: z.array(BrowserConfigSchema).min(1).default([{
    name: 'chrome',
    headless: false,
    args: ['disable-native-automation']
  }]),
  timeout: z.number().min(1000).max(300000).default(30000),
  speed: z.number().min(0.01).max(1).default(1),
  concurrency: z.number().min(1).max(10).default(1),
  quarantineMode: z.boolean().default(false),
  skipJsErrors: z.boolean().default(false),
  skipUncaughtErrors: z.boolean().default(false),
  stopOnFirstFail: z.boolean().default(false)
});

/**
 * Server configuration schema
 */
export const ServerConfigSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  debug: z.boolean().default(false),
  maxConcurrentTests: z.number().min(1).max(5).default(3)
});

/**
 * Complete configuration schema
 */
export const ConfigSchema = z.object({
  server: ServerConfigSchema,
  testcafe: TestCafeConfigSchema
});

export type BrowserConfig = z.infer<typeof BrowserConfigSchema>;
export type TestCafeConfig = z.infer<typeof TestCafeConfigSchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;

/**
 * Configuration Manager
 * 
 * Manages configuration loading, validation, and default values.
 */
export class ConfigManager {
  private config: Config;

  constructor(userConfig?: Partial<Config>) {
    this.config = this.validateAndMergeConfig(userConfig);
  }

  /**
   * Get the complete configuration
   */
  getConfig(): Config {
    return { ...this.config };
  }

  /**
   * Get server configuration
   */
  getServerConfig(): ServerConfig {
    return { ...this.config.server };
  }

  /**
   * Get TestCafe configuration
   */
  getTestCafeConfig(): TestCafeConfig {
    return { ...this.config.testcafe };
  }

  /**
   * Update configuration with new values
   */
  updateConfig(updates: Partial<Config>): void {
    const mergedConfig = this.mergeConfigs(this.config, updates);
    this.config = this.validateConfig(mergedConfig);
  }

  /**
   * Validate browser configuration
   */
  static validateBrowserConfig(config: unknown): BrowserConfig {
    return BrowserConfigSchema.parse(config);
  }

  /**
   * Validate TestCafe configuration
   */
  static validateTestCafeConfig(config: unknown): TestCafeConfig {
    return TestCafeConfigSchema.parse(config);
  }

  /**
   * Get default configuration
   */
  static getDefaultConfig(): Config {
    return ConfigSchema.parse({
      server: {
        name: 'testcafe-mcp-server',
        version: '1.0.0'
      },
      testcafe: {}
    });
  }

  /**
   * Validate and merge user configuration with defaults
   */
  private validateAndMergeConfig(userConfig?: Partial<Config>): Config {
    const defaultConfig = ConfigManager.getDefaultConfig();
    const mergedConfig = userConfig ? this.mergeConfigs(defaultConfig, userConfig) : defaultConfig;
    return this.validateConfig(mergedConfig);
  }

  /**
   * Validate configuration against schema
   */
  private validateConfig(config: unknown): Config {
    try {
      return ConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        ).join(', ');
        throw new Error(`Configuration validation failed: ${errorMessages}`);
      }
      throw error;
    }
  }

  /**
   * Deep merge two configuration objects
   */
  private mergeConfigs(base: any, override: any): any {
    const result = { ...base };
    
    for (const key in override) {
      if (override[key] !== undefined) {
        if (typeof override[key] === 'object' && !Array.isArray(override[key]) && override[key] !== null) {
          result[key] = this.mergeConfigs(result[key] || {}, override[key]);
        } else {
          result[key] = override[key];
        }
      }
    }
    
    return result;
  }
}