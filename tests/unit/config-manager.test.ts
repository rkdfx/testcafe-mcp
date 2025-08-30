/**
 * Basic unit tests for ConfigManager
 */
import { ConfigManager } from '../../src/config/config-manager.js';

describe('ConfigManager', () => {
  describe('constructor', () => {
    it('should create with default configuration', () => {
      const config = new ConfigManager();
      expect(config).toBeInstanceOf(ConfigManager);
    });

    it('should throw error for invalid configuration', () => {
      const invalidConfig = {
        server: { 
          name: '', // Empty name should be invalid
          version: '1.0.0',
          debug: false,
          maxConcurrentTests: 1
        }
      };
      expect(() => new ConfigManager(invalidConfig)).toThrow();
    });
  });

  describe('getServerConfig', () => {
    it('should return server configuration', () => {
      const config = new ConfigManager();
      const serverConfig = config.getServerConfig();
      
      expect(serverConfig).toHaveProperty('name');
      expect(serverConfig).toHaveProperty('version');
      expect(typeof serverConfig.name).toBe('string');
      expect(typeof serverConfig.version).toBe('string');
      expect(serverConfig.name.length).toBeGreaterThan(0);
    });
  });

  describe('getTestCafeConfig', () => {
    it('should return TestCafe configuration', () => {
      const config = new ConfigManager();
      const testcafeConfig = config.getTestCafeConfig();
      
      expect(testcafeConfig).toHaveProperty('browsers');
      expect(Array.isArray(testcafeConfig.browsers)).toBe(true);
      expect(testcafeConfig.browsers.length).toBeGreaterThan(0);
      expect(testcafeConfig).toHaveProperty('timeout');
      expect(typeof testcafeConfig.timeout).toBe('number');
    });
  });

  describe('getConfig', () => {
    it('should return complete configuration', () => {
      const config = new ConfigManager();
      const fullConfig = config.getConfig();
      
      expect(fullConfig).toHaveProperty('server');
      expect(fullConfig).toHaveProperty('testcafe');
    });
  });

  describe('static validation methods', () => {
    it('should validate browser configuration', () => {
      const validBrowser = {
        name: 'chrome',
        headless: true,
        args: []
      };
      
      const result = ConfigManager.validateBrowserConfig(validBrowser);
      expect(result.name).toBe('chrome');
      expect(result.headless).toBe(true);
    });

    it('should reject invalid browser configuration', () => {
      const invalidBrowser = {
        name: 'invalid-browser',
        headless: true
      };
      
      expect(() => ConfigManager.validateBrowserConfig(invalidBrowser)).toThrow();
    });
  });
});
