# 🚀 Setup and Installation Guide

## Prerequisites

### Node.js 22
This application requires **Node.js 22** or higher for ES modules, top-level await, and enhanced async features.

**Check your Node.js version:**
```powershell
node --version
```

**Install Node.js 22:**
- Download from [nodejs.org](https://nodejs.org/)
- Or use a version manager like `nvm` or `fnm`

### Environment Setup

1. **Clone or copy the project files**
2. **Navigate to the project directory:**
   ```powershell
   cd C:\Users\Matt Franklin\orc-legacy-to-2.0-migration\legacy-migration-tool
   ```

3. **Install dependencies:**
   ```powershell
   npm install
   ```

4. **Create environment configuration:**
   ```powershell
   Copy-Item .env.example .env
   ```

5. **Configure environment variables in `.env`:**
   ```bash
   # Legacy API Configuration
   LEGACY_API_BASE_URL=https://dsapi.sessionupload.com
   LEGACY_API_TOKEN=your-legacy-api-token-here
   
   # Current System API Configuration
   CURRENT_API_BASE_URL=https://ss-dev.showsiteserver.com
   CURRENT_API_TOKEN=your-current-api-token-here
   
   # Current Files API Configuration
   CURRENT_FILES_API_BASE_URL=https://ss-dev.showsiteserver.com
   CURRENT_FILES_API_TOKEN=your-files-api-token-here
   
   # Optional: Override default settings
   DEFAULT_TIMEOUT=30000
   DEFAULT_MAX_CONCURRENT_ROOMS=3
   DEFAULT_MAX_RETRIES=3
   DEFAULT_RETRY_DELAY=1000
   
   # Logging Configuration
   LOG_LEVEL=info
   LOG_TO_FILE=true
   LOG_FILE_PATH=logs/migration.log
   ```

## Quick Start

### 1. Test the Installation
```powershell
npm test
```

### 2. Run Help Command
```powershell
npm start -- --help
```

### 3. Perform a Dry Run
```powershell
npm start -- "YourEventName" 123 --dry-run --verbose
```

## Usage Examples

### Basic Migration (All Rooms)
```powershell
npm start -- "NACDS2024" 123
```

### Migrate Specific Room
```powershell
npm start -- "NACDS2024" 123 "Main Auditorium"
```

### Dry Run with Verbose Logging
```powershell
npm start -- "NACDS2024" 123 --dry-run --verbose
```

### Skip File Migration
```powershell
npm start -- "NACDS2024" 123 --skip-files
```

### Custom Concurrency
```powershell
npm start -- "NACDS2024" 123 --max-concurrent 5
```

### Custom Timeout
```powershell
npm start -- "NACDS2024" 123 --timeout 60000
```

## Configuration Files

### API Endpoints (`config/api-endpoints.json`)
Configure API endpoints for different environments:
```json
{
  "legacy": {
    "events": "/api/events/{eventName}",
    "rooms": "/api/events/{eventName}/rooms",
    "sessions": "/api/events/{eventName}/rooms/{roomName}/sessions",
    "users": "/api/events/{eventName}/rooms/{roomName}/users",
    "files": "/api/events/{eventName}/rooms/{roomName}/files/{fileName}"
  },
  "current": {
    "events": "/api/v2/events/{eventId}",
    "rooms": "/api/v2/events/{eventId}/rooms",
    "sessions": "/api/v2/events/{eventId}/rooms/{roomId}/sessions",
    "users": "/api/v2/events/{eventId}/rooms/{roomId}/users",
    "files": "/api/v2/files/upload"
  }
}
```

### DTO Mappings
- `config/legacy-dtos.json` - Legacy system data structure
- `config/current-dtos.json` - Current system data structure

## Troubleshooting

### Common Issues

1. **"Node.js 22 or higher is required"**
   - Update Node.js to version 22 or higher
   - Verify with `node --version`

2. **"Missing required environment variables"**
   - Ensure `.env` file exists and contains all required variables
   - Check that API tokens are valid and have proper permissions

3. **"Connection refused" or API errors**
   - Verify API endpoints are accessible
   - Check network connectivity
   - Confirm API tokens have proper permissions

4. **"Module not found" errors**
   - Run `npm install` to install dependencies
   - Ensure you're using Node.js 22 with ES modules support

### Debug Mode
Enable verbose logging for detailed troubleshooting:
```powershell
npm start -- "YourEvent" 123 --verbose --dry-run
```

### Log Files
Check the log files for detailed error information:
- `logs/migration.log` - Main application log
- `logs/migration-error.log` - Error-specific log

## Development

### Run Tests
```powershell
# Run all tests
npm test

# Run specific test file
npm test -- --grep "ConfigManager"

# Run with coverage (if configured)
npm run test:coverage
```

### Code Structure
```
src/
├── config/           # Configuration management
├── services/         # Business logic services
├── clients/          # API client implementations
├── models/           # Data models and DTOs
├── utils/            # Utility functions
├── ui/               # Console UI components
└── index.js          # Main application entry point
```

### Adding New Features
1. Follow the existing service pattern
2. Add appropriate error handling
3. Include logging for debugging
4. Write tests for new functionality
5. Update configuration if needed

## Performance Tuning

### Concurrency Settings
- `--max-concurrent` - Number of parallel room migrations
- Default: 3 (recommended for most scenarios)
- Higher values may improve speed but increase memory usage

### Timeout Settings
- `--timeout` - Request timeout in milliseconds
- Default: 30000 (30 seconds)
- Increase for slow network connections

### Memory Usage
- Monitor memory usage during large migrations
- Consider processing in smaller batches if memory is limited

## API Rate Limiting

The application includes built-in rate limiting and retry logic:
- Automatic retry on transient failures
- Exponential backoff for rate limiting
- Configurable retry attempts and delays

## Security Considerations

- Store API tokens securely in `.env` file
- Never commit `.env` file to version control
- Use environment-specific API endpoints
- Regularly rotate API tokens
- Monitor API usage and permissions

## Support

For issues or questions:
1. Check the logs for detailed error information
2. Review the configuration files
3. Test with `--dry-run` first
4. Use `--verbose` for debugging
5. Verify Node.js version and dependencies
