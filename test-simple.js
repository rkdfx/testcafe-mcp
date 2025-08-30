// Simple test to check if modules work
import { ConfigManager } from './dist/config/index.js';

console.log('Testing module import...');
const config = new ConfigManager();
console.log('Config created successfully');
console.log('Server config:', config.getServerConfig());
