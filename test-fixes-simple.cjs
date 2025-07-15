const fs = require('fs');
const path = require('path');

console.log('🔧 Testing migration system fixes...');

// Test 1: Check if current-dtos.json has correct structure
try {
  const dtosPath = path.join(__dirname, 'config', 'dtos', 'current-dtos.json');
  const dtosContent = JSON.parse(fs.readFileSync(dtosPath, 'utf8'));
  
  // Check room creation DTO
  const roomDto = dtosContent.room.create;
  if (roomDto.required.includes('eventLocationId') && 
      roomDto.validation.eventLocationId.type === 'integer') {
    console.log('✅ Room DTO updated correctly with eventLocationId as integer');
  } else {
    console.log('❌ Room DTO not updated correctly');
  }
  
  // Check session creation DTO
  const sessionDto = dtosContent.session.create;
  if (sessionDto.optional.includes('sessionTypeId') && 
      sessionDto.validation.sessionTypeId.nullable === true) {
    console.log('✅ Session DTO updated correctly with sessionTypeId as optional');
  } else {
    console.log('❌ Session DTO not updated correctly');
  }
  
} catch (error) {
  console.error('❌ DTO configuration test failed:', error.message);
}

// Test 2: Check if API endpoints include eventLocations
try {
  const endpointsPath = path.join(__dirname, 'config', 'api-endpoints.json');
  const endpointsContent = JSON.parse(fs.readFileSync(endpointsPath, 'utf8'));
  
  if (endpointsContent.current.eventApi.endpoints.eventLocations) {
    console.log('✅ Event locations endpoint added to configuration');
  } else {
    console.log('❌ Event locations endpoint not found in configuration');
  }
} catch (error) {
  console.error('❌ API endpoints test failed:', error.message);
}

// Test 3: Check API specifications are stored
try {
  const specsDir = path.join(__dirname, 'docs', 'api-specs');
  const files = fs.readdirSync(specsDir);
  
  if (files.includes('event-api-swagger.json') && 
      files.includes('files-api-swagger.json') && 
      files.includes('auth-api-swagger.json')) {
    console.log('✅ All API specifications stored correctly');
  } else {
    console.log('❌ API specifications not found');
  }
} catch (error) {
  console.error('❌ API specifications test failed:', error.message);
}

console.log('🎉 Fix validation completed!');
