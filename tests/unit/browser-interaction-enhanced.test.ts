/**
 * Enhanced Browser Interaction Service Tests
 * 
 * Tests for the enhanced live execution capabilities
 */

import { BrowserInteractionService, BrowserAction } from '../../src/services/browser-interaction-service.js';

describe('Enhanced Browser Interaction Service', () => {
  let service: BrowserInteractionService;

  beforeEach(() => {
    service = new BrowserInteractionService();
  });

  afterEach(async () => {
    if (service) {
      await service.close();
    }
  });

  describe('Service Initialization', () => {
    it('should create service instance', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(BrowserInteractionService);
    });

    it('should close service without errors', async () => {
      await expect(service.close()).resolves.not.toThrow();
    });
  });

  describe('Static Methods', () => {
    it('should create form fill sequence', () => {
      const sequence = BrowserInteractionService.createFormFillSequence([
        { selector: '#username', value: 'testuser', type: 'type' },
        { selector: '#password', value: 'testpass', type: 'type' }
      ], '#submit');

      expect(Array.isArray(sequence)).toBe(true);
      expect(sequence.length).toBeGreaterThan(0);
    });

    it('should create navigation sequence', () => {
      const sequence = BrowserInteractionService.createNavigationSequence(
        'https://example.com',
        [{ type: 'element', value: '#main-content', timeout: 10000 }]
      );

      expect(Array.isArray(sequence)).toBe(true);
      expect(sequence.length).toBeGreaterThan(0);
    });
  });
});