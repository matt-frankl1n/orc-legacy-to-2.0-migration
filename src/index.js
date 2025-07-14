#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

// Node.js 22 ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Import core modules
import { MigrationService } from './services/MigrationService.js';
import { ConfigManager } from './config/ConfigManager.js';
import { LoggerService } from './services/LoggerService.js';
import { ConsoleManager } from './ui/ConsoleManager.js';

// Load package.json for version
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

/**
 * Main entry point for the Legacy Migration Tool
 * Node.js 22 application with ES modules and top-level await
 */
class MigrationApplication {
  constructor() {
    this.program = new Command();
    this.logger = null;
    this.consoleManager = null;
    this.migrationService = null;
  }

  /**
   * Initialize the application
   */
  async initialize() {
    try {
      // Initialize logger first
      this.logger = LoggerService.getInstance();
      
      // Initialize console manager
      this.consoleManager = new ConsoleManager(this.logger);
      
      // Load configuration
      const config = ConfigManager.load();
      
      // Initialize migration service
      this.migrationService = new MigrationService(config, this.logger);
      
      this.logger.info('🚀 Legacy Migration Tool initialized successfully');
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize application:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Setup CLI commands using Commander.js
   */
  setupCommands() {
    this.program
      .name('legacy-migration-tool')
      .description('🔄 Migrate legacy orchestrate data to current system')
      .version(packageJson.version)
      .argument('<legacyEventName>', 'Legacy event name to migrate from')
      .argument('<targetEventId>', 'Target event ID in current system', this.parseEventId)
      .argument('[roomName]', 'Specific room name to migrate (optional - migrates all rooms if not specified)')
      .option('-v, --verbose', 'Enable verbose logging')
      .option('--skip-files', 'Skip file migration')
      .option('--dry-run', 'Perform a dry run without making changes')
      .option('--max-concurrent <number>', 'Maximum concurrent room migrations', parseInt)
      .option('--timeout <number>', 'Request timeout in milliseconds', parseInt)
      .action(this.executeMigration.bind(this));

    // Add help examples
    this.program.addHelpText('after', `
${chalk.blue('Examples:')}
  ${chalk.green('npm start "NACDS2024" 123')}                     # Migrate all rooms
  ${chalk.green('npm start "NACDS2024" 123 "Main Auditorium"')}   # Migrate specific room
  ${chalk.green('npm start "NACDS2024" 123 --verbose')}           # Enable verbose logging
  ${chalk.green('npm start "NACDS2024" 123 --dry-run')}           # Test without changes
  ${chalk.green('npm start "NACDS2024" 123 --skip-files')}        # Skip file migration

${chalk.blue('Environment:')}
  Configure API credentials in .env file
  See .env.example for required variables
`);
  }

  /**
   * Parse and validate event ID argument
   */
  parseEventId(value) {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed <= 0) {
      throw new Error('Target event ID must be a positive number');
    }
    return parsed;
  }

  /**
   * Execute migration - main execution method
   */
  async executeMigration(legacyEventName, targetEventId, roomName, options) {
    // Validate Node.js version
    this.validateNodeVersion();

    // Set up process handlers
    this.setupProcessHandlers();

    const startTime = Date.now();
    
    try {
      // Build configuration from CLI arguments
      const migrationConfig = ConfigManager.validateConfig({
        legacyEventName: legacyEventName.trim(),
        targetEventId,
        roomName: roomName?.trim() || null,
        migrateAllRooms: !roomName?.trim(),
        verbose: options.verbose || false,
        skipFiles: options.skipFiles || false,
        dryRun: options.dryRun || false,
        maxConcurrentRooms: options.maxConcurrent || null,
        timeout: options.timeout || null
      });

      // Display startup information
      this.consoleManager.showStartupInfo(migrationConfig);

      // Execute migration
      const result = await this.migrationService.executeMigration(migrationConfig);

      // Display results
      this.consoleManager.showMigrationResults(result, Date.now() - startTime);

      // Exit with appropriate code
      process.exit(result.success ? 0 : 1);

    } catch (error) {
      this.logger.error('Migration failed:', error);
      this.consoleManager.showError(error);
      process.exit(1);
    }
  }

  /**
   * Validate Node.js version
   */
  validateNodeVersion() {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
    
    if (majorVersion < 22) {
      console.error(chalk.red('❌ Node.js 22 or higher is required'));
      console.error(chalk.yellow(`   Current version: ${nodeVersion}`));
      console.error(chalk.yellow('   Please upgrade Node.js to continue'));
      process.exit(1);
    }
  }

  /**
   * Setup process event handlers
   */
  setupProcessHandlers() {
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      this.logger?.info('🛑 Received SIGINT, shutting down gracefully...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      this.logger?.info('🛑 Received SIGTERM, shutting down gracefully...');
      process.exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger?.error('💥 Uncaught exception:', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger?.error('💥 Unhandled promise rejection:', reason);
      process.exit(1);
    });
  }

  /**
   * Start the application
   */
  async start() {
    try {
      // Initialize application
      await this.initialize();
      
      // Setup CLI commands
      this.setupCommands();
      
      // Parse command line arguments
      await this.program.parseAsync(process.argv);
      
    } catch (error) {
      console.error(chalk.red('❌ Application startup failed:'), error.message);
      process.exit(1);
    }
  }
}

// Main execution - utilizing Node.js 22 top-level await
const app = new MigrationApplication();
await app.start();
