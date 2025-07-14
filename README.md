# Legacy Migration Tool - Node.js 22

🚀 **Modern Node.js 22 application** to migrate legacy orchestrate data from `dsapi.sessionupload.com` to the current orchestrate system at `ss-dev.showsiteserver.com`.

## Features

- ✅ **Configuration-driven architecture** - All API endpoints and DTOs externalized
- ✅ **Dynamic DTO management** - Flexible data structure handling
- ✅ **Parallel processing** - Efficient concurrent room migration
- ✅ **File migration** - Complete file transfer with progress tracking
- ✅ **Real-time console UI** - Live progress updates with emojis
- ✅ **Comprehensive error handling** - Graceful error recovery
- ✅ **Dry run mode** - Test migrations without making changes
- ✅ **Node.js 22 features** - ES modules, top-level await, enhanced performance

## Requirements

- **Node.js 22.0.0+** (Latest LTS)
- Valid API credentials for both legacy and current systems

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your API credentials
   ```

3. **Run migration**:
   ```bash
   # Migrate all rooms from legacy event to target event
   npm start "NACDS2024" 123

   # Migrate specific room
   npm start "NACDS2024" 123 "Main Auditorium"

   # Test with dry run
   npm start "NACDS2024" 123 --dry-run
   ```

## Usage

```bash
npm start <legacyEventName> <targetEventId> [roomName] [options]
```

### Arguments
- `legacyEventName` - Legacy event name to migrate from
- `targetEventId` - Target event ID in current system (number)
- `roomName` - Optional specific room name (migrates all rooms if not specified)

### Options
- `-v, --verbose` - Enable verbose logging
- `--skip-files` - Skip file migration
- `--dry-run` - Perform a dry run without making changes

### Examples

```bash
# Migrate all rooms with verbose logging
npm start "NACDS2024" 456 --verbose

# Migrate specific room without files
npm start "PharmacyConf" 789 "Breakout Room 1" --skip-files

# Test migration without making changes
npm start "NACDS2024" 456 --dry-run
```

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Legacy System Configuration
LEGACY_API_URL=https://dsapi.sessionupload.com
LEGACY_API_KEY=your-legacy-api-key
LEGACY_BEARER_TOKEN=your-legacy-bearer-token

# Current System Configuration
CURRENT_EVENT_API_URL=https://ss-dev.showsiteserver.com/event-api
CURRENT_FILES_API_URL=https://ss-dev.showsiteserver.com/files-api
CURRENT_BEARER_TOKEN=your-current-system-bearer-token

# Migration Settings
MAX_CONCURRENT_ROOMS=6
ENABLE_FILE_MIGRATION=true
LOG_LEVEL=info
```

### API Endpoints

Configure endpoints in `config/api-endpoints.json`:

```json
{
  "legacy": {
    "baseUrl": "https://dsapi.sessionupload.com",
    "endpoints": {
      "events": "/v2/Events/{eventName}",
      "rooms": "/v2/Events/{eventName}/Rooms",
      "sessions": "/v2/Events/{eventName}/Sessions",
      "files": "/v2/Events/{eventName}/Files"
    }
  },
  "current": {
    "eventApi": {
      "baseUrl": "https://ss-dev.showsiteserver.com/event-api",
      "endpoints": {
        "events": "/Events",
        "rooms": "/Events/{eventId}/Rooms",
        "sessions": "/Events/{eventId}/Sessions"
      }
    }
  }
}
```

### Data Transfer Objects (DTOs)

Configure data mappings in `config/dtos/`:
- `legacy-dtos.json` - Legacy system data structures
- `current-dtos.json` - Current system data structures

## Architecture

### Service Layer Pattern
- `MigrationService` - Core migration orchestration
- `FileService` - File migration with progress tracking
- `ValidationService` - Data validation and transformation

### HTTP Client Pattern
- `LegacyApiClient` - Legacy system API integration
- `CurrentSystemApiClient` - Current system API integration

### Configuration Management
- `ConfigManager` - Dynamic configuration loading
- `AuthManager` - Authentication handling

## Development

### Running Tests
```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration
```

### Development Mode
```bash
# Watch mode for development
npm run dev
```

## Migration Flow

1. **Initialization** - Load configuration and validate connectivity
2. **Data Retrieval** - Fetch data from legacy system
3. **Data Transformation** - Map legacy DTOs to current system DTOs
4. **Data Creation** - Create entities in target system
5. **File Migration** - Transfer files with progress tracking
6. **Reporting** - Generate migration statistics and error reports

## Error Handling

- **Graceful degradation** - Continue processing when possible
- **Detailed logging** - Context-aware error reporting
- **Retry logic** - Automatic retry for transient failures
- **Partial success** - Report partial completions

## Performance Features

- **Parallel processing** - Concurrent room migration with semaphore control
- **Streaming** - Memory-efficient file handling
- **Connection pooling** - Optimized HTTP connections
- **Progress tracking** - Real-time status updates

## Troubleshooting

### Common Issues

1. **Authentication errors** - Check bearer tokens in `.env`
2. **Network timeouts** - Verify API endpoints are accessible
3. **Memory issues** - Reduce `MAX_CONCURRENT_ROOMS` in `.env`
4. **File migration failures** - Use `--skip-files` to isolate issues

### Debug Mode
```bash
# Enable verbose logging
npm start "event-name" 123 --verbose

# Check configuration
node -e "import('./src/config/ConfigManager.js').then(m => console.log(m.ConfigManager.load()))"
```

## Contributing

1. Ensure Node.js 22+ is installed
2. Follow ES module patterns
3. Use built-in Node.js 22 test runner
4. Update configuration files for API changes
5. Add comprehensive error handling

## License

MIT License - see LICENSE file for details
