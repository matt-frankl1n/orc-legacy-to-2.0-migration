import { ConfigManager } from '../config/ConfigManager.js';
import Joi from 'joi';

/**
 * Validation Service - Handles data validation and transformation
 * Transforms legacy DTOs to current system DTOs with validation
 */
export class ValidationService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.legacyDTOs = config.dtos.legacy;
    this.currentDTOs = config.dtos.current;
  }

  /**
   * Transform legacy room data to current system format
   */
  async transformLegacyRoom(legacyRoom, targetEventId) {
    try {
      this.logger.debug(`Transforming legacy room: ${legacyRoom.name}`);
      
      // Get DTO mappings
      const legacyMapping = this.legacyDTOs.room;
      const currentMapping = this.currentDTOs.room.create;
      
      // Transform data
      const transformedRoom = {
        eventId: targetEventId,
        name: legacyRoom.name,
        description: legacyRoom.description || null,
        locationName: legacyRoom.location || null,
        maxCapacity: legacyRoom.capacity || null,
        tags: this.transformTags(legacyRoom),
        legacyId: legacyRoom.id
      };
      
      // Validate transformed data
      await this.validateCurrentSystemData('room', 'create', transformedRoom);
      
      this.logger.debug(`Successfully transformed room: ${legacyRoom.name}`);
      return transformedRoom;
      
    } catch (error) {
      this.logger.error(`Failed to transform legacy room: ${legacyRoom.name}`, error);
      throw new Error(`Room transformation failed: ${error.message}`);
    }
  }

  /**
   * Transform legacy session data to current system format
   */
  async transformLegacySession(legacySession, roomId, targetEventId) {
    try {
      this.logger.debug(`Transforming legacy session: ${legacySession.title}`);
      
      // Transform data
      const transformedSession = {
        eventId: targetEventId,
        roomId: roomId,
        title: legacySession.title,
        description: legacySession.description || null,
        startDateTime: this.transformDateTime(legacySession.startTime),
        endDateTime: this.transformDateTime(legacySession.endTime),
        presenter: this.transformPresenter(legacySession.presenter),
        moderator: this.transformModerator(legacySession.moderator),
        tags: this.transformSessionTags(legacySession),
        metadata: this.transformSessionMetadata(legacySession),
        status: this.transformSessionStatus(legacySession.status),
        legacyId: legacySession.id
      };
      
      // Validate transformed data
      await this.validateCurrentSystemData('session', 'create', transformedSession);
      
      this.logger.debug(`Successfully transformed session: ${legacySession.title}`);
      return transformedSession;
      
    } catch (error) {
      this.logger.error(`Failed to transform legacy session: ${legacySession.title}`, error);
      throw new Error(`Session transformation failed: ${error.message}`);
    }
  }

  /**
   * Transform legacy subsession data to current system format
   */
  async transformLegacySubSession(legacySubSession, sessionId, targetEventId) {
    try {
      this.logger.debug(`Transforming legacy subsession: ${legacySubSession.title}`);
      
      // Transform data
      const transformedSubSession = {
        eventId: targetEventId,
        parentSessionId: sessionId,
        title: legacySubSession.title,
        description: legacySubSession.description || null,
        startDateTime: this.transformDateTime(legacySubSession.startTime),
        endDateTime: this.transformDateTime(legacySubSession.endTime),
        presenter: this.transformPresenter(legacySubSession.presenter),
        tags: this.transformSessionTags(legacySubSession),
        status: this.transformSessionStatus(legacySubSession.status),
        legacyId: legacySubSession.id
      };
      
      // Validate transformed data
      await this.validateCurrentSystemData('subSession', 'create', transformedSubSession);
      
      this.logger.debug(`Successfully transformed subsession: ${legacySubSession.title}`);
      return transformedSubSession;
      
    } catch (error) {
      this.logger.error(`Failed to transform legacy subsession: ${legacySubSession.title}`, error);
      throw new Error(`SubSession transformation failed: ${error.message}`);
    }
  }

  /**
   * Transform legacy user data to current system format
   */
  async transformLegacyUser(legacyUser, targetEventId) {
    try {
      this.logger.debug(`Transforming legacy user: ${legacyUser.email}`);
      
      // Transform data
      const transformedUser = {
        eventId: targetEventId,
        email: legacyUser.email,
        firstName: legacyUser.firstName,
        lastName: legacyUser.lastName,
        company: legacyUser.company || null,
        jobTitle: legacyUser.title || null,
        phoneNumber: legacyUser.phone || null,
        tags: this.transformUserTags(legacyUser),
        metadata: this.transformUserMetadata(legacyUser),
        legacyId: legacyUser.id
      };
      
      // Validate transformed data
      await this.validateCurrentSystemData('user', 'create', transformedUser);
      
      this.logger.debug(`Successfully transformed user: ${legacyUser.email}`);
      return transformedUser;
      
    } catch (error) {
      this.logger.error(`Failed to transform legacy user: ${legacyUser.email}`, error);
      throw new Error(`User transformation failed: ${error.message}`);
    }
  }

  /**
   * Transform legacy moderator data to current system format
   */
  async transformLegacyModerator(legacyUser, userId, roomId, targetEventId) {
    try {
      this.logger.debug(`Transforming legacy moderator: ${legacyUser.email}`);
      
      // Transform data
      const transformedModerator = {
        eventId: targetEventId,
        userId: userId,
        roomId: roomId,
        role: this.transformModeratorRole(legacyUser.role),
        permissions: this.transformModeratorPermissions(legacyUser.permissions),
        tags: this.transformModeratorTags(legacyUser),
        legacyId: legacyUser.id
      };
      
      // Validate transformed data
      await this.validateCurrentSystemData('moderator', 'create', transformedModerator);
      
      this.logger.debug(`Successfully transformed moderator: ${legacyUser.email}`);
      return transformedModerator;
      
    } catch (error) {
      this.logger.error(`Failed to transform legacy moderator: ${legacyUser.email}`, error);
      throw new Error(`Moderator transformation failed: ${error.message}`);
    }
  }

  /**
   * Transform legacy file data to current system format
   */
  async transformLegacyFile(legacyFile, associatedId, targetEventId, fileType = 'session') {
    try {
      this.logger.debug(`Transforming legacy file: ${legacyFile.fileName}`);
      
      // Determine file type and create appropriate structure
      const baseFileData = {
        originalFileName: legacyFile.fileName,
        fileSizeBytes: legacyFile.fileSize,
        mimeType: legacyFile.fileType || this.determineMimeType(legacyFile.fileName),
        description: legacyFile.description || null,
        tags: this.transformFileTags(legacyFile),
        metadata: this.transformFileMetadata(legacyFile),
        legacyId: legacyFile.id
      };
      
      // Add type-specific fields
      let transformedFile;
      switch (fileType) {
        case 'session':
          transformedFile = {
            ...baseFileData,
            sessionId: associatedId
          };
          await this.validateCurrentSystemData('sessionFile', 'create', transformedFile);
          break;
          
        case 'subSession':
          transformedFile = {
            ...baseFileData,
            subSessionId: associatedId
          };
          await this.validateCurrentSystemData('subSessionFile', 'create', transformedFile);
          break;
          
        case 'user':
          transformedFile = {
            ...baseFileData,
            userId: associatedId
          };
          await this.validateCurrentSystemData('userFile', 'create', transformedFile);
          break;
          
        case 'moderator':
          transformedFile = {
            ...baseFileData,
            moderatorId: associatedId
          };
          await this.validateCurrentSystemData('moderatorFile', 'create', transformedFile);
          break;
          
        default:
          throw new Error(`Unknown file type: ${fileType}`);
      }
      
      this.logger.debug(`Successfully transformed file: ${legacyFile.fileName}`);
      return transformedFile;
      
    } catch (error) {
      this.logger.error(`Failed to transform legacy file: ${legacyFile.fileName}`, error);
      throw new Error(`File transformation failed: ${error.message}`);
    }
  }

  /**
   * Transform tags from legacy format
   */
  transformTags(legacyData) {
    const tags = {};
    
    if (legacyData.custom1) tags.category = legacyData.custom1;
    if (legacyData.custom2) tags.type = legacyData.custom2;
    if (legacyData.custom3) tags.level = legacyData.custom3;
    if (legacyData.tags) tags.additional = legacyData.tags;
    
    return Object.keys(tags).length > 0 ? tags : null;
  }

  /**
   * Transform session tags
   */
  transformSessionTags(legacySession) {
    const tags = [];
    
    if (legacySession.tags) {
      tags.push(...(Array.isArray(legacySession.tags) ? legacySession.tags : [legacySession.tags]));
    }
    
    if (legacySession.custom1) tags.push(legacySession.custom1);
    if (legacySession.custom2) tags.push(legacySession.custom2);
    
    return tags.length > 0 ? tags : null;
  }

  /**
   * Transform user tags
   */
  transformUserTags(legacyUser) {
    const tags = [];
    
    if (legacyUser.tags) {
      tags.push(...(Array.isArray(legacyUser.tags) ? legacyUser.tags : [legacyUser.tags]));
    }
    
    if (legacyUser.custom1) tags.push(legacyUser.custom1);
    if (legacyUser.custom2) tags.push(legacyUser.custom2);
    
    return tags.length > 0 ? tags : null;
  }

  /**
   * Transform file tags
   */
  transformFileTags(legacyFile) {
    const tags = [];
    
    if (legacyFile.tags) {
      tags.push(...(Array.isArray(legacyFile.tags) ? legacyFile.tags : [legacyFile.tags]));
    }
    
    if (legacyFile.custom1) tags.push(legacyFile.custom1);
    if (legacyFile.custom2) tags.push(legacyFile.custom2);
    
    return tags.length > 0 ? tags : null;
  }

  /**
   * Transform moderator tags
   */
  transformModeratorTags(legacyUser) {
    const tags = [];
    
    if (legacyUser.tags) {
      tags.push(...(Array.isArray(legacyUser.tags) ? legacyUser.tags : [legacyUser.tags]));
    }
    
    if (legacyUser.role) tags.push(`role:${legacyUser.role}`);
    
    return tags.length > 0 ? tags : null;
  }

  /**
   * Transform session metadata
   */
  transformSessionMetadata(legacySession) {
    const metadata = {};
    
    if (legacySession.custom1) metadata.category = legacySession.custom1;
    if (legacySession.custom2) metadata.type = legacySession.custom2;
    if (legacySession.presenter) metadata.presenterInfo = legacySession.presenter;
    if (legacySession.moderator) metadata.moderatorInfo = legacySession.moderator;
    
    return Object.keys(metadata).length > 0 ? metadata : null;
  }

  /**
   * Transform user metadata
   */
  transformUserMetadata(legacyUser) {
    const metadata = {};
    
    if (legacyUser.custom1) metadata.department = legacyUser.custom1;
    if (legacyUser.custom2) metadata.role = legacyUser.custom2;
    if (legacyUser.registrationDate) metadata.registrationDate = legacyUser.registrationDate;
    
    return Object.keys(metadata).length > 0 ? metadata : null;
  }

  /**
   * Transform file metadata
   */
  transformFileMetadata(legacyFile) {
    const metadata = {};
    
    if (legacyFile.custom1) metadata.category = legacyFile.custom1;
    if (legacyFile.custom2) metadata.type = legacyFile.custom2;
    if (legacyFile.uploadDate) metadata.uploadDate = legacyFile.uploadDate;
    if (legacyFile.uploader) metadata.uploader = legacyFile.uploader;
    
    return Object.keys(metadata).length > 0 ? metadata : null;
  }

  /**
   * Transform datetime string
   */
  transformDateTime(dateTimeString) {
    if (!dateTimeString) return null;
    
    try {
      const date = new Date(dateTimeString);
      return date.toISOString();
    } catch (error) {
      this.logger.warn(`Failed to parse datetime: ${dateTimeString}`);
      return null;
    }
  }

  /**
   * Transform presenter information
   */
  transformPresenter(presenterData) {
    if (!presenterData) return null;
    
    if (typeof presenterData === 'string') {
      return { name: presenterData };
    }
    
    return {
      name: presenterData.name || null,
      email: presenterData.email || null,
      company: presenterData.company || null,
      title: presenterData.title || null
    };
  }

  /**
   * Transform moderator information
   */
  transformModerator(moderatorData) {
    if (!moderatorData) return null;
    
    if (typeof moderatorData === 'string') {
      return { name: moderatorData };
    }
    
    return {
      name: moderatorData.name || null,
      email: moderatorData.email || null,
      role: moderatorData.role || 'moderator'
    };
  }

  /**
   * Transform session status
   */
  transformSessionStatus(legacyStatus) {
    const statusMap = {
      'active': 'scheduled',
      'live': 'in_progress',
      'completed': 'completed',
      'cancelled': 'cancelled',
      'draft': 'scheduled'
    };
    
    return statusMap[legacyStatus?.toLowerCase()] || 'scheduled';
  }

  /**
   * Transform moderator role
   */
  transformModeratorRole(legacyRole) {
    const roleMap = {
      'admin': 'admin',
      'moderator': 'moderator',
      'presenter': 'presenter',
      'host': 'moderator'
    };
    
    return roleMap[legacyRole?.toLowerCase()] || 'moderator';
  }

  /**
   * Transform moderator permissions
   */
  transformModeratorPermissions(legacyPermissions) {
    if (!legacyPermissions) return ['moderate'];
    
    if (Array.isArray(legacyPermissions)) {
      return legacyPermissions;
    }
    
    if (typeof legacyPermissions === 'string') {
      return legacyPermissions.split(',').map(p => p.trim());
    }
    
    return ['moderate'];
  }

  /**
   * Determine MIME type from filename
   */
  determineMimeType(fileName) {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const mimeTypes = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'txt': 'text/plain',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'mp4': 'video/mp4',
      'avi': 'video/x-msvideo',
      'mov': 'video/quicktime',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed'
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
  }

  /**
   * Validate current system data using Joi schemas
   */
  async validateCurrentSystemData(entityType, operation, data) {
    const dtoConfig = this.currentDTOs[entityType]?.[operation];
    
    if (!dtoConfig) {
      throw new Error(`No DTO configuration found for ${entityType}.${operation}`);
    }
    
    // Build Joi schema from DTO configuration
    const schema = this.buildJoiSchema(dtoConfig);
    
    // Validate data
    const { error, value } = schema.validate(data, { abortEarly: false });
    
    if (error) {
      const validationErrors = error.details.map(detail => detail.message);
      throw new Error(`Validation failed for ${entityType}: ${validationErrors.join(', ')}`);
    }
    
    return value;
  }

  /**
   * Build Joi schema from DTO configuration
   */
  buildJoiSchema(dtoConfig) {
    const schemaObj = {};
    
    // Add required fields
    dtoConfig.required.forEach(field => {
      schemaObj[field] = Joi.required();
    });
    
    // Add optional fields
    if (dtoConfig.optional) {
      dtoConfig.optional.forEach(field => {
        schemaObj[field] = Joi.optional();
      });
    }
    
    // Apply validation rules
    if (dtoConfig.validation) {
      Object.entries(dtoConfig.validation).forEach(([field, rules]) => {
        if (schemaObj[field]) {
          schemaObj[field] = this.applyValidationRules(schemaObj[field], rules);
        }
      });
    }
    
    return Joi.object(schemaObj);
  }

  /**
   * Apply validation rules to Joi field
   */
  applyValidationRules(joiField, rules) {
    let field = joiField;
    
    if (rules.type) {
      switch (rules.type) {
        case 'number':
          field = Joi.number();
          break;
        case 'email':
          field = Joi.string().email();
          break;
        case 'datetime':
          field = Joi.string().isoDate();
          break;
        case 'array':
          field = Joi.array();
          break;
        case 'object':
          field = Joi.object();
          break;
        default:
          field = Joi.string();
      }
    }
    
    if (rules.maxLength) {
      field = field.max(rules.maxLength);
    }
    
    if (rules.minLength) {
      field = field.min(rules.minLength);
    }
    
    if (rules.min !== undefined) {
      field = field.min(rules.min);
    }
    
    if (rules.max !== undefined) {
      field = field.max(rules.max);
    }
    
    if (rules.pattern) {
      field = field.pattern(new RegExp(rules.pattern));
    }
    
    if (rules.enum) {
      field = field.valid(...rules.enum);
    }
    
    return field;
  }

  /**
   * Validate legacy data format
   */
  async validateLegacyData(entityType, data) {
    const dtoConfig = this.legacyDTOs[entityType];
    
    if (!dtoConfig) {
      throw new Error(`No legacy DTO configuration found for ${entityType}`);
    }
    
    // Check required fields
    const missingFields = dtoConfig.required.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields in legacy ${entityType}: ${missingFields.join(', ')}`);
    }
    
    return true;
  }

  /**
   * Get validation statistics
   */
  getValidationStatistics() {
    return {
      legacyDTOs: Object.keys(this.legacyDTOs).length,
      currentDTOs: Object.keys(this.currentDTOs).length,
      supportedTransformations: [
        'room',
        'session',
        'subSession',
        'user',
        'moderator',
        'sessionFile',
        'subSessionFile',
        'userFile',
        'moderatorFile'
      ]
    };
  }
}
