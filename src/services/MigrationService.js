import { LegacyApiClient } from '../clients/LegacyApiClient.js';
import { CurrentSystemApiClient } from '../clients/CurrentSystemApiClient.js';
import { FileService } from './FileService.js';
import { ValidationService } from './ValidationService.js';
import { MigrationResult } from '../models/MigrationResult.js';
import { ParallelProcessor } from '../utils/ParallelProcessor.js';
import { ProgressTracker } from '../utils/ProgressTracker.js';
import { ConfigManager } from '../config/ConfigManager.js';

/**
 * Main Migration Service - Orchestrates the entire migration process
 * Coordinates between legacy and current systems to transfer data
 */
export class MigrationService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    
    // Initialize API clients
    this.legacyClient = new LegacyApiClient(config, logger);
    this.currentClient = new CurrentSystemApiClient(config, logger);
    
    // Initialize services
    this.fileService = new FileService(config, logger);
    this.validationService = new ValidationService(config, logger);
    
    // Initialize utilities
    this.parallelProcessor = new ParallelProcessor(config.migration.maxConcurrentRooms, logger);
    this.progressTracker = new ProgressTracker(logger);
  }

  /**
   * Execute migration based on configuration
   */
  async executeMigration(configuration) {
    const result = new MigrationResult();
    result.configuration = configuration;
    
    try {
      this.logger.migrationStart(configuration);
      
      // Validate environment and connectivity
      await this.validateEnvironment();
      
      // Execute migration based on configuration
      if (configuration.migrateAllRooms) {
        await this.migrateAllRooms(configuration, result);
      } else {
        await this.migrateSingleRoom(configuration, result);
      }
      
      // Finalize result
      result.endTime = new Date();
      result.success = result.errors.length === 0;
      
      this.logger.migrationEnd(result, result.getDuration());
      
      return result;
      
    } catch (error) {
      result.addError('Migration execution', error);
      result.endTime = new Date();
      result.success = false;
      
      this.logger.error('Migration failed:', error);
      return result;
    }
  }

  /**
   * Migrate all rooms from legacy event to target event
   */
  async migrateAllRooms(configuration, result) {
    const { legacyEventName, targetEventId, verbose, skipFiles, dryRun } = configuration;
    
    try {
      if (verbose) this.logger.info('🔍 Fetching all rooms from legacy event...');
      
      // Fetch all rooms from legacy system
      const rooms = await this.legacyClient.getRooms(legacyEventName);
      
      if (rooms.length === 0) {
        this.logger.warn('No rooms found in legacy event');
        return;
      }
      
      this.logger.info(`Found ${rooms.length} rooms to migrate`);
      
      if (dryRun) {
        this.logger.info(`Would migrate ${rooms.length} rooms (DRY RUN)`);
        result.statistics.roomsProcessed = rooms.length;
        result.dryRun = true;
        return;
      }
      
      // Process rooms in parallel
      const roomResults = await this.parallelProcessor.processRooms(
        rooms,
        (room) => this.processRoom(room, targetEventId, { verbose, skipFiles }),
        (current, total) => this.progressTracker.updateProgress('Room Migration', current, total)
      );
      
      // Aggregate results
      this.aggregateRoomResults(roomResults, result);
      
    } catch (error) {
      result.addError('All rooms migration', error);
      throw error;
    }
  }

  /**
   * Migrate single room from legacy event to target event
   */
  async migrateSingleRoom(configuration, result) {
    const { legacyEventName, targetEventId, roomName, verbose, skipFiles, dryRun } = configuration;
    
    try {
      if (verbose) this.logger.info(`🔍 Fetching room "${roomName}" from legacy event...`);
      
      // Fetch specific room from legacy system
      const room = await this.legacyClient.getRoom(legacyEventName, roomName);
      
      if (!room) {
        throw new Error(`Room "${roomName}" not found in legacy event`);
      }
      
      if (dryRun) {
        this.logger.info(`Would migrate room "${roomName}" (DRY RUN)`);
        result.statistics.roomsProcessed = 1;
        result.dryRun = true;
        return;
      }
      
      // Process the room
      const roomResult = await this.processRoom(room, targetEventId, { verbose, skipFiles });
      
      // Update result
      result.statistics.roomsProcessed = 1;
      if (roomResult.success) {
        result.statistics.sessionsCreated += roomResult.sessionsCreated;
        result.statistics.filesUploaded += roomResult.filesUploaded;
        result.statistics.usersProcessed += roomResult.usersProcessed;
      } else {
        result.errors.push(...roomResult.errors);
      }
      
    } catch (error) {
      result.addError('Single room migration', error);
      throw error;
    }
  }

  /**
   * Process a single room with all its associated data
   */
  async processRoom(room, targetEventId, options = {}) {
    const { verbose, skipFiles } = options;
    const roomResult = { success: true, errors: [], sessionsCreated: 0, filesUploaded: 0, usersProcessed: 0 };
    const startTime = Date.now();
    
    try {
      this.logger.roomStart(room.name);
      
      // Step 1: Transform and validate room data
      const transformedRoom = await this.validationService.transformLegacyRoom(room, targetEventId);
      
      // Step 2: Create room in current system
      const createdRoom = await this.currentClient.createRoom(transformedRoom);
      if (verbose) this.logger.info(`✅ Room "${room.name}" created with ID: ${createdRoom.id}`);
      
      // Step 3: Fetch and process sessions
      const sessions = await this.legacyClient.getSessions(room.eventName, room.name);
      if (sessions.length > 0) {
        const sessionResults = await this.processSessions(sessions, createdRoom.id, targetEventId, options);
        roomResult.sessionsCreated = sessionResults.created;
        roomResult.errors.push(...sessionResults.errors);
      }
      
      // Step 4: Fetch and process users/moderators
      const users = await this.legacyClient.getUsers(room.eventName, room.name);
      if (users.length > 0) {
        const userResults = await this.processUsers(users, createdRoom.id, targetEventId, options);
        roomResult.usersProcessed = userResults.processed;
        roomResult.errors.push(...userResults.errors);
      }
      
      // Step 5: Process files if not skipped
      if (!skipFiles) {
        const files = await this.legacyClient.getFiles(room.eventName, room.name);
        if (files.length > 0) {
          const fileResults = await this.processFiles(files, createdRoom.id, targetEventId, options);
          roomResult.filesUploaded = fileResults.uploaded;
          roomResult.errors.push(...fileResults.errors);
        }
      }
      
      this.logger.roomEnd(room.name, roomResult.errors.length === 0, Date.now() - startTime);
      
    } catch (error) {
      roomResult.success = false;
      roomResult.errors.push({
        context: `Room processing: ${room.name}`,
        error: error.message,
        stack: error.stack
      });
      
      this.logger.roomEnd(room.name, false, Date.now() - startTime);
    }
    
    return roomResult;
  }

  /**
   * Process sessions for a room
   */
  async processSessions(sessions, roomId, targetEventId, options = {}) {
    const { verbose } = options;
    const result = { created: 0, errors: [] };
    
    try {
      for (const session of sessions) {
        try {
          this.logger.sessionStart(session.title);
          
          // Transform session data
          const transformedSession = await this.validationService.transformLegacySession(session, roomId, targetEventId);
          
          // Create session in current system
          const createdSession = await this.currentClient.createSession(transformedSession);
          result.created++;
          
          if (verbose) this.logger.info(`✅ Session "${session.title}" created with ID: ${createdSession.id}`);
          
          // Process subsessions if they exist
          if (session.subSessions && session.subSessions.length > 0) {
            await this.processSubSessions(session.subSessions, createdSession.id, targetEventId, options);
          }
          
          this.logger.sessionEnd(session.title, true, 0);
          
        } catch (error) {
          result.errors.push({
            context: `Session processing: ${session.title}`,
            error: error.message,
            stack: error.stack
          });
          
          this.logger.sessionEnd(session.title, false, 0);
        }
      }
    } catch (error) {
      result.errors.push({
        context: 'Sessions processing',
        error: error.message,
        stack: error.stack
      });
    }
    
    return result;
  }

  /**
   * Process subsessions for a session
   */
  async processSubSessions(subSessions, sessionId, targetEventId, options = {}) {
    const { verbose } = options;
    
    for (const subSession of subSessions) {
      try {
        // Transform subsession data
        const transformedSubSession = await this.validationService.transformLegacySubSession(subSession, sessionId, targetEventId);
        
        // Create subsession in current system
        const createdSubSession = await this.currentClient.createSubSession(transformedSubSession);
        
        if (verbose) this.logger.info(`✅ SubSession "${subSession.title}" created with ID: ${createdSubSession.id}`);
        
      } catch (error) {
        this.logger.error(`Failed to process subsession "${subSession.title}":`, error);
      }
    }
  }

  /**
   * Process users for a room
   */
  async processUsers(users, roomId, targetEventId, options = {}) {
    const { verbose } = options;
    const result = { processed: 0, errors: [] };
    
    try {
      for (const user of users) {
        try {
          this.logger.userStart(user.email);
          
          // Transform user data
          const transformedUser = await this.validationService.transformLegacyUser(user, targetEventId);
          
          // Create user in current system
          const createdUser = await this.currentClient.createUser(transformedUser);
          result.processed++;
          
          if (verbose) this.logger.info(`✅ User "${user.email}" created with ID: ${createdUser.id}`);
          
          // Create moderator relationship if applicable
          if (user.isModerator) {
            const moderatorData = await this.validationService.transformLegacyModerator(user, createdUser.id, roomId, targetEventId);
            await this.currentClient.createModerator(moderatorData);
          }
          
          this.logger.userEnd(user.email, true, 0);
          
        } catch (error) {
          result.errors.push({
            context: `User processing: ${user.email}`,
            error: error.message,
            stack: error.stack
          });
          
          this.logger.userEnd(user.email, false, 0);
        }
      }
    } catch (error) {
      result.errors.push({
        context: 'Users processing',
        error: error.message,
        stack: error.stack
      });
    }
    
    return result;
  }

  /**
   * Process files for a room
   */
  async processFiles(files, roomId, targetEventId, options = {}) {
    const { verbose } = options;
    const result = { uploaded: 0, errors: [] };
    
    try {
      for (const file of files) {
        try {
          this.logger.fileOperation('processing', file.fileName);
          
          // Download file from legacy system
          const fileData = await this.legacyClient.downloadFile(file.downloadUrl);
          
          // Transform file metadata
          const transformedFile = await this.validationService.transformLegacyFile(file, roomId, targetEventId);
          
          // Upload file to current system
          const uploadResult = await this.fileService.uploadFile(fileData, transformedFile);
          result.uploaded++;
          
          if (verbose) this.logger.info(`✅ File "${file.fileName}" uploaded with ID: ${uploadResult.id}`);
          
        } catch (error) {
          result.errors.push({
            context: `File processing: ${file.fileName}`,
            error: error.message,
            stack: error.stack
          });
          
          this.logger.fileError('processing', file.fileName, error);
        }
      }
    } catch (error) {
      result.errors.push({
        context: 'Files processing',
        error: error.message,
        stack: error.stack
      });
    }
    
    return result;
  }

  /**
   * Aggregate results from parallel room processing
   */
  aggregateRoomResults(roomResults, result) {
    for (const roomResult of roomResults) {
      if (roomResult.success) {
        result.statistics.roomsProcessed++;
        result.statistics.sessionsCreated += roomResult.sessionsCreated;
        result.statistics.filesUploaded += roomResult.filesUploaded;
        result.statistics.usersProcessed += roomResult.usersProcessed;
      }
      
      result.errors.push(...roomResult.errors);
    }
  }

  /**
   * Validate environment and connectivity
   */
  async validateEnvironment() {
    try {
      // Validate configuration
      ConfigManager.validateEnvironment();
      
      // Test connectivity to legacy system
      await this.legacyClient.testConnection();
      
      // Test connectivity to current system
      await this.currentClient.testConnection();
      
      this.logger.info('✅ Environment validation passed');
      
    } catch (error) {
      this.logger.error('❌ Environment validation failed:', error);
      throw error;
    }
  }

  /**
   * Get migration statistics
   */
  getStatistics() {
    return {
      legacyConnectionStatus: this.legacyClient.getConnectionStatus(),
      currentConnectionStatus: this.currentClient.getConnectionStatus(),
      parallelProcessorStats: this.parallelProcessor.getStatistics(),
      progressTrackerStats: this.progressTracker.getStatistics()
    };
  }
}
