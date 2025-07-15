# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Running the Application
```bash
# Start migration with all required arguments
npm start "NACDS2024" 123

# Start migration for specific room
npm start "NACDS2024" 123 "Main Auditorium"

# Development mode with file watching
npm run dev

# Dry run mode for testing
npm start "NACDS2024" 123 --dry-run

# Verbose logging
npm start "NACDS2024" 123 --verbose
```

### Testing
```bash
# Run all tests (uses Node.js 22 built-in test runner)
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration
```

### Linting
- Project uses Node.js 22 built-in features
- No external linter configured
- `npm run lint` shows informational message

## Architecture Overview

### Service Layer Pattern
The application follows a layered architecture with clear separation of concerns:

- **MigrationService** (src/services/MigrationService.js) - Main orchestration logic that coordinates the entire migration process
- **API Clients** - LegacyApiClient and CurrentSystemApiClient handle external API communication
- **Utility Services** - FileService, ValidationService, LoggerService provide specialized functionality
- **Configuration Management** - ConfigManager loads settings from JSON files and environment variables

### Core Components

#### Main Entry Point
- **src/index.js** - CLI application using Commander.js, handles argument parsing and application initialization

#### Services
- **src/services/MigrationService.js** - Main orchestration, coordinates between legacy and current systems
- **src/services/FileService.js** - File upload/download with streaming support and progress tracking
- **src/services/ValidationService.js** - Data transformation and validation using Joi schemas
- **src/services/LoggerService.js** - Winston-based structured logging

#### API Clients
- **src/clients/LegacyApiClient.js** - Communicates with dsapi.sessionupload.com legacy system
- **src/clients/CurrentSystemApiClient.js** - Communicates with ss-dev.showsiteserver.com current system

#### Utilities
- **src/utils/ParallelProcessor.js** - Manages concurrent processing with semaphore control
- **src/utils/ProgressTracker.js** - Real-time progress monitoring and statistics
- **src/ui/ConsoleManager.js** - Beautiful console output with colors and formatting

### Configuration Architecture

#### External Configuration Files
- **config/api-endpoints.json** - All API endpoint definitions for both systems
- **config/dtos/legacy-dtos.json** - Legacy system data structure definitions
- **config/dtos/current-dtos.json** - Current system data structure definitions

#### Environment Configuration
- **.env** file for sensitive configuration (API tokens, URLs)
- **src/config/ConfigManager.js** - Loads and validates all configuration

## Node.js 22 Features

This codebase leverages modern Node.js 22 features:
- **ES Modules** throughout (import/export syntax)
- **Top-level await** for cleaner async code
- **Built-in test runner** (no external test framework needed)
- **Enhanced performance** features

## Migration Flow

1. **Initialization** - Load configuration, validate environment, check API connectivity
2. **Data Retrieval** - Fetch rooms/sessions from legacy system using LegacyApiClient
3. **Data Transformation** - Convert legacy DTOs to current system format using ValidationService
4. **Parallel Processing** - Use ParallelProcessor to migrate multiple rooms concurrently
5. **File Migration** - Transfer files using FileService with progress tracking
6. **Progress Monitoring** - Real-time updates via ProgressTracker and ConsoleManager

## Key Design Patterns

### Configuration-Driven
- All API endpoints externalized to JSON files
- DTO mappings configurable without code changes
- Environment-based configuration for deployment flexibility

### Error Handling
- Comprehensive error boundaries in all major components
- Retry logic with exponential backoff
- Graceful degradation - continue processing when possible
- Detailed error logging without exposing sensitive data

### Performance
- Parallel processing with configurable concurrency limits
- Memory-efficient streaming for file operations
- Connection pooling for HTTP clients
- Progress tracking for long-running operations

## Testing Strategy

- **Unit tests** in tests/unit/ directory test individual components
- **Integration tests** in tests/integration/ test full workflows
- Uses Node.js 22 built-in test runner (no Jest/Mocha dependency)
- Tests focus on error handling, data transformation, and API integration