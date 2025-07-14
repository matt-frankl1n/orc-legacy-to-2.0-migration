import chalk from 'chalk';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { table } = require('table');

/**
 * Console Manager - Handles all console output and user interface
 * Provides formatted output, progress display, and error reporting
 */
export class ConsoleManager {
  constructor(logger) {
    this.logger = logger;
    this.startTime = new Date();
    
    // Console configuration
    this.config = {
      width: process.stdout.columns || 80,
      useColors: !process.env.NO_COLOR && process.stdout.isTTY,
      showEmojis: !process.env.NO_EMOJIS
    };
  }

  /**
   * Show startup information
   */
  showStartupInfo(configuration) {
    this.clearConsole();
    
    console.log(chalk.blue('🚀 Legacy Migration Tool - Node.js 22'));
    console.log(chalk.blue('━'.repeat(50)));
    console.log();
    
    // Configuration information
    console.log(chalk.bold('📋 Migration Configuration:'));
    console.log(`   ${chalk.cyan('Legacy Event:')} ${configuration.legacyEventName}`);
    console.log(`   ${chalk.cyan('Target Event ID:')} ${configuration.targetEventId}`);
    
    if (configuration.migrateAllRooms) {
      console.log(`   ${chalk.cyan('Scope:')} All rooms`);
    } else {
      console.log(`   ${chalk.cyan('Scope:')} Single room - "${configuration.roomName}"`);
    }
    
    // Options
    const options = [];
    if (configuration.verbose) options.push('Verbose logging');
    if (configuration.skipFiles) options.push('Skip files');
    if (configuration.dryRun) options.push('Dry run');
    
    if (options.length > 0) {
      console.log(`   ${chalk.cyan('Options:')} ${options.join(', ')}`);
    }
    
    console.log();
    
    // Dry run warning
    if (configuration.dryRun) {
      console.log(chalk.yellow('⚠️  DRY RUN MODE - No changes will be made'));
      console.log();
    }
    
    // Start processing indicator
    console.log(chalk.green('🔄 Starting migration process...'));
    console.log();
  }

  /**
   * Show migration results
   */
  showMigrationResults(result, totalDuration) {
    console.log();
    console.log(chalk.blue('━'.repeat(50)));
    
    if (result.success) {
      console.log(chalk.green('✅ Migration completed successfully!'));
    } else {
      console.log(chalk.red('❌ Migration completed with errors'));
    }
    
    console.log(chalk.blue('━'.repeat(50)));
    console.log();
    
    // Show statistics
    this.showStatistics(result.statistics, totalDuration);
    
    // Show performance summary
    if (result.performance) {
      this.showPerformanceSummary(result.performance);
    }
    
    // Show errors if any
    if (result.errors.length > 0) {
      this.showErrorSummary(result.errors);
    }
    
    // Show warnings if any
    if (result.warnings.length > 0) {
      this.showWarningSummary(result.warnings);
    }
    
    // Show final summary
    this.showFinalSummary(result);
  }

  /**
   * Show statistics table
   */
  showStatistics(statistics, totalDuration) {
    console.log(chalk.bold('📊 Migration Statistics:'));
    console.log();
    
    const statsData = [
      ['Metric', 'Value'],
      ['Rooms Processed', statistics.roomsProcessed.toString()],
      ['Sessions Created', statistics.sessionsCreated.toString()],
      ['SubSessions Created', statistics.subSessionsCreated.toString()],
      ['Users Processed', statistics.usersProcessed.toString()],
      ['Moderators Created', statistics.moderatorsCreated.toString()],
      ['Files Uploaded', statistics.filesUploaded.toString()],
      ['Total File Size', this.formatFileSize(statistics.totalFileSizeBytes)],
      ['Total Duration', this.formatDuration(totalDuration)],
      ['Average Room Time', this.formatDuration(statistics.averageRoomProcessingTime)],
      ['Average Session Time', this.formatDuration(statistics.averageSessionProcessingTime)],
      ['Average File Upload Time', this.formatDuration(statistics.averageFileUploadTime)]
    ];
    
    const tableConfig = {
      border: {
        topBody: '─',
        topJoin: '┬',
        topLeft: '┌',
        topRight: '┐',
        bottomBody: '─',
        bottomJoin: '┴',
        bottomLeft: '└',
        bottomRight: '┘',
        bodyLeft: '│',
        bodyRight: '│',
        bodyJoin: '│',
        joinBody: '─',
        joinLeft: '├',
        joinRight: '┤',
        joinJoin: '┼'
      },
      columns: {
        0: { width: 25, alignment: 'left' },
        1: { width: 20, alignment: 'right' }
      }
    };
    
    console.log(table(statsData, tableConfig));
  }

  /**
   * Show performance summary
   */
  showPerformanceSummary(performance) {
    console.log(chalk.bold('⚡ Performance Summary:'));
    console.log();
    
    const performanceData = [
      ['Metric', 'Value'],
      ['Total Duration', this.formatDuration(performance.totalDuration)],
      ['API Calls (Legacy)', performance.apiResponseTimes.legacy.length.toString()],
      ['API Calls (Current)', performance.apiResponseTimes.current.length.toString()],
      ['Peak Memory Usage', this.formatFileSize(performance.memoryUsage.peak.rss)],
      ['Memory Efficiency', this.calculateMemoryEfficiency(performance.memoryUsage)]
    ];
    
    if (performance.roomProcessingTimes.length > 0) {
      const avgRoomTime = performance.roomProcessingTimes.reduce((sum, t) => sum + t.duration, 0) / performance.roomProcessingTimes.length;
      performanceData.push(['Avg Room Processing', this.formatDuration(avgRoomTime)]);
    }
    
    if (performance.fileUploadTimes.length > 0) {
      const avgFileTime = performance.fileUploadTimes.reduce((sum, t) => sum + t.duration, 0) / performance.fileUploadTimes.length;
      performanceData.push(['Avg File Upload', this.formatDuration(avgFileTime)]);
    }
    
    const tableConfig = {
      border: {
        topBody: '─',
        topJoin: '┬',
        topLeft: '┌',
        topRight: '┐',
        bottomBody: '─',
        bottomJoin: '┴',
        bottomLeft: '└',
        bottomRight: '┘',
        bodyLeft: '│',
        bodyRight: '│',
        bodyJoin: '│',
        joinBody: '─',
        joinLeft: '├',
        joinRight: '┤',
        joinJoin: '┼'
      },
      columns: {
        0: { width: 25, alignment: 'left' },
        1: { width: 20, alignment: 'right' }
      }
    };
    
    console.log(table(performanceData, tableConfig));
  }

  /**
   * Show error summary
   */
  showErrorSummary(errors) {
    console.log(chalk.bold.red('❌ Errors:'));
    console.log();
    
    if (errors.length === 0) {
      console.log(chalk.green('   No errors reported'));
      return;
    }
    
    // Group errors by context
    const errorsByContext = {};
    errors.forEach(error => {
      if (!errorsByContext[error.context]) {
        errorsByContext[error.context] = [];
      }
      errorsByContext[error.context].push(error);
    });
    
    // Display errors by context
    Object.entries(errorsByContext).forEach(([context, contextErrors]) => {
      console.log(chalk.red(`   📍 ${context}:`));
      
      contextErrors.forEach((error, index) => {
        console.log(chalk.red(`      ${index + 1}. ${error.message}`));
        
        if (error.timestamp) {
          console.log(chalk.gray(`         Time: ${error.timestamp.toLocaleString()}`));
        }
      });
      
      console.log();
    });
    
    // Show error summary
    console.log(chalk.red(`   Total errors: ${errors.length}`));
    console.log();
  }

  /**
   * Show warning summary
   */
  showWarningSummary(warnings) {
    console.log(chalk.bold.yellow('⚠️  Warnings:'));
    console.log();
    
    if (warnings.length === 0) {
      console.log(chalk.green('   No warnings reported'));
      return;
    }
    
    warnings.forEach((warning, index) => {
      console.log(chalk.yellow(`   ${index + 1}. ${warning.context}: ${warning.message}`));
      
      if (warning.details) {
        console.log(chalk.gray(`      Details: ${JSON.stringify(warning.details)}`));
      }
      
      if (warning.timestamp) {
        console.log(chalk.gray(`      Time: ${warning.timestamp.toLocaleString()}`));
      }
    });
    
    console.log();
  }

  /**
   * Show final summary
   */
  showFinalSummary(result) {
    console.log(chalk.bold('🎯 Final Summary:'));
    console.log();
    
    const summary = result.getMigrationSummary();
    
    // Success indicator
    if (summary.success) {
      console.log(chalk.green(`   ✅ Migration: ${summary.success ? 'SUCCESS' : 'FAILED'}`));
    } else {
      console.log(chalk.red(`   ❌ Migration: ${summary.success ? 'SUCCESS' : 'FAILED'}`));
    }
    
    // Dry run indicator
    if (summary.dryRun) {
      console.log(chalk.yellow('   🧪 Mode: DRY RUN'));
    }
    
    console.log(`   ⏱️  Duration: ${summary.duration}`);
    console.log(`   📈 Success Rate: ${summary.successRate}`);
    console.log(`   🏠 Rooms: ${summary.statistics.roomsProcessed}`);
    console.log(`   📅 Sessions: ${summary.statistics.sessionsCreated}`);
    console.log(`   👥 Users: ${summary.statistics.usersProcessed}`);
    console.log(`   📁 Files: ${summary.statistics.filesUploaded}`);
    
    if (summary.errors > 0) {
      console.log(chalk.red(`   ❌ Errors: ${summary.errors}`));
    }
    
    if (summary.warnings > 0) {
      console.log(chalk.yellow(`   ⚠️  Warnings: ${summary.warnings}`));
    }
    
    console.log();
    
    // Show next steps
    this.showNextSteps(result);
  }

  /**
   * Show next steps
   */
  showNextSteps(result) {
    console.log(chalk.bold('🔮 Next Steps:'));
    console.log();
    
    if (result.success) {
      console.log(chalk.green('   ✅ Migration completed successfully!'));
      console.log('   📝 Review the migration logs for detailed information');
      console.log('   🔍 Verify the migrated data in the target system');
      console.log('   🗂️  Archive or cleanup legacy data if needed');
    } else {
      console.log(chalk.red('   ❌ Migration completed with errors'));
      console.log('   📋 Review error details above');
      console.log('   🔧 Fix configuration or data issues');
      console.log('   🔄 Re-run the migration after fixes');
      console.log('   💡 Consider using --dry-run to test changes');
    }
    
    console.log();
    
    // Show log file locations
    console.log(chalk.bold('📁 Log Files:'));
    console.log(`   📄 Main log: ${chalk.cyan('logs/migration.log')}`);
    console.log(`   🚨 Error log: ${chalk.cyan('logs/migration-errors.log')}`);
    console.log();
  }

  /**
   * Show error message
   */
  showError(error) {
    console.log();
    console.log(chalk.red('━'.repeat(50)));
    console.log(chalk.red('❌ MIGRATION FAILED'));
    console.log(chalk.red('━'.repeat(50)));
    console.log();
    
    console.log(chalk.bold.red('Error Details:'));
    console.log(chalk.red(`   Message: ${error.message}`));
    
    if (error.stack) {
      console.log(chalk.red('   Stack Trace:'));
      console.log(chalk.gray(error.stack.split('\\n').map(line => `      ${line}`).join('\\n')));
    }
    
    console.log();
    console.log(chalk.yellow('💡 Troubleshooting Tips:'));
    console.log('   • Check your .env file for correct API credentials');
    console.log('   • Verify network connectivity to API endpoints');
    console.log('   • Review the error log for more details');
    console.log('   • Try running with --verbose for more information');
    console.log('   • Use --dry-run to test without making changes');
    console.log();
  }

  /**
   * Show progress update
   */
  showProgress(operation, current, total, details = null) {
    const percentage = Math.round((current / total) * 100);
    const progressBar = this.createProgressBar(current, total, 40);
    
    let message = `${operation}: ${progressBar} ${percentage}% (${current}/${total})`;
    
    if (details) {
      message += ` - ${details}`;
    }
    
    // Use carriage return to overwrite previous line
    process.stdout.write(`\\r${message}`);
    
    // Move to next line when complete
    if (current === total) {
      console.log();
    }
  }

  /**
   * Create ASCII progress bar
   */
  createProgressBar(current, total, width = 40) {
    const percentage = current / total;
    const completed = Math.round(percentage * width);
    const remaining = width - completed;
    
    const completedChar = '█';
    const remainingChar = '░';
    
    return `[${completedChar.repeat(completed)}${remainingChar.repeat(remaining)}]`;
  }

  /**
   * Format file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  /**
   * Format duration
   */
  formatDuration(milliseconds) {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    }
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Calculate memory efficiency
   */
  calculateMemoryEfficiency(memoryUsage) {
    const startMB = memoryUsage.start.rss / 1024 / 1024;
    const peakMB = memoryUsage.peak.rss / 1024 / 1024;
    const endMB = memoryUsage.end ? memoryUsage.end.rss / 1024 / 1024 : peakMB;
    
    const efficiency = Math.round((startMB / peakMB) * 100);
    return `${efficiency}%`;
  }

  /**
   * Clear console
   */
  clearConsole() {
    if (process.stdout.isTTY) {
      process.stdout.write('\\x1Bc');
    }
  }

  /**
   * Show loading spinner
   */
  showLoadingSpinner(message) {
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    
    const interval = setInterval(() => {
      process.stdout.write(`\\r${spinner[i]} ${message}`);
      i = (i + 1) % spinner.length;
    }, 100);
    
    return {
      stop: () => {
        clearInterval(interval);
        process.stdout.write('\\r');
      }
    };
  }

  /**
   * Show table
   */
  showTable(data, options = {}) {
    const tableConfig = {
      border: {
        topBody: '─',
        topJoin: '┬',
        topLeft: '┌',
        topRight: '┐',
        bottomBody: '─',
        bottomJoin: '┴',
        bottomLeft: '└',
        bottomRight: '┘',
        bodyLeft: '│',
        bodyRight: '│',
        bodyJoin: '│',
        joinBody: '─',
        joinLeft: '├',
        joinRight: '┤',
        joinJoin: '┼'
      },
      ...options
    };
    
    console.log(table(data, tableConfig));
  }
}
