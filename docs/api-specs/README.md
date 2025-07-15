# API Specifications

This directory contains the OpenAPI (Swagger) specifications for the Show Site Server APIs used in the migration process.

## Files

### `event-api-swagger.json`
OpenAPI 3.0.1 specification for the Event API (v1)
- **Base URL**: `/event-api`
- **Description**: Event management API providing tools for configuring and managing presentations, speakers, moderators, and speaker-ready rooms
- **Authentication**: Bearer token (JWT)

Key endpoints:
- `POST /Events/{eventId}/Rooms` - Create new rooms
- `POST /Events/{eventId}/Sessions` - Create new sessions
- `GET /Events/{eventId}` - Get event details
- `GET /Events/{eventId}/Locations` - Get event locations

### `files-api-swagger.json`
OpenAPI 3.0.1 specification for the Files API (v1)
- **Base URL**: `/files-api`
- **Description**: File management API for upload, download, and metadata management
- **Authentication**: Bearer token (JWT)

Key endpoints:
- `POST /SessionFiles` - Create session files
- `POST /SubSessionFiles` - Create sub-session files
- `POST /UserFiles` - Create user files
- `GET /AllFiles/Events/{eventId}` - Get all files for an event
- `POST /AllFiles/Events/{eventId}/FileTypes/{fileType}/Files/Metadata` - Create file metadata

### `auth-api-swagger.json`
OpenAPI 3.0.1 specification for the Auth API (v1)
- **Base URL**: `/auth-api`
- **Description**: API for managing authentication and authorization operations
- **Authentication**: Bearer token (JWT)

Key endpoints:
- `POST /Auth/Events/{eventId}/register` - Register a new user
- `POST /Auth/login` - Authenticate user and get access token
- `POST /Auth/reset-password` - Reset user password
- `POST /Auth/change-password` - Change user password
- `POST /Auth/forgot-password` - Handle forgot password requests
- `POST /Auth/Events/{eventId}/adduserrole` - Add roles to a user
- `POST /Auth/Events/{eventId}/removeuserrole` - Remove roles from a user

## Usage

These specifications are used to:
1. Validate current DTO configurations against official API schemas
2. Reference correct field names, types, and validation rules
3. Ensure migration tool compatibility with API changes
4. Document API endpoints used in the migration process

## Environment

The specifications are for the staging environment:
- Event API: `https://ss-stage.showsiteserver.com/event-api`
- Files API: `https://ss-stage.showsiteserver.com/files-api`
- Auth API: `https://ss-stage.showsiteserver.com/auth-api`

## Validation

Always validate current DTO configurations in `config/dtos/current-dtos.json` against these specifications to ensure accuracy and compatibility.
