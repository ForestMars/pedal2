/**
 * Utility functions for parsing PRD documents and extracting domain entities
 */

/**
 * Extract domain entities from a PRD document
 * @param {Object} prdContent - The PRD document content
 * @returns {Array<Object>} - Extracted domain entities
 */
function extractDomainEntities(prdContent) {
  const entities = [];
  const text = typeof prdContent === 'string' ? prdContent : JSON.stringify(prdContent);
  
  // Look for entity definitions in structured or unstructured text
  // This is a simplified implementation - in production, you would use
  // more sophisticated NLP techniques or structured input formats
  
  // Pattern matching for "Entity: [Name]" with optional properties
  const entityRegex = /Entity:\s*(\w+)(?:\s*{([^}]+)})?/g;
  let match;
  
  while ((match = entityRegex.exec(text)) !== null) {
    const entityName = match[1].trim();
    const propertiesText = match[2] || '';
    
    const entity = {
      name: entityName,
      properties: []
    };
    
    // Extract properties if available
    if (propertiesText) {
      const propertyLines = propertiesText.split('\n');
      
      propertyLines.forEach(line => {
        const propertyMatch = line.match(/(\w+)(?:\s*:\s*(\w+))?/);
        if (propertyMatch) {
          entity.properties.push({
            name: propertyMatch[1].trim(),
            type: propertyMatch[2] ? propertyMatch[2].trim() : 'string'
          });
        }
      });
    }
    
    entities.push(entity);
  }
  
  return entities;
}

/**
 * Extract business logic and actions from a PRD document
 * @param {Object} prdContent - The PRD document content
 * @returns {Array<Object>} - Extracted API actions
 */
function extractApiActions(prdContent) {
  const actions = [];
  const text = typeof prdContent === 'string' ? prdContent : JSON.stringify(prdContent);
  
  // Look for action definitions in structured or unstructured text
  // This is a simplified implementation
  
  // Pattern matching for "Action: [Name]" with optional details
  const actionRegex = /Action:\s*(\w+)(?:\s*{([^}]+)})?/g;
  let match;
  
  while ((match = actionRegex.exec(text)) !== null) {
    const actionName = match[1].trim();
    const detailsText = match[2] || '';
    
    const action = {
      name: actionName,
      method: 'GET', // Default method
      parameters: [],
      responses: []
    };
    
    // Extract details if available
    if (detailsText) {
      // Extract HTTP method
      const methodMatch = detailsText.match(/Method:\s*(\w+)/i);
      if (methodMatch) {
        action.method = methodMatch[1].toUpperCase();
      }
      
      // Extract parameters
      const paramRegex = /Param(?:eter)?:\s*(\w+)(?:\s*:\s*(\w+))?(?:\s*\(([^)]+)\))?/g;
      let paramMatch;
      
      while ((paramMatch = paramRegex.exec(detailsText)) !== null) {
        action.parameters.push({
          name: paramMatch[1].trim(),
          type: paramMatch[2] ? paramMatch[2].trim() : 'string',
          description: paramMatch[3] ? paramMatch[3].trim() : ''
        });
      }
      
      // Extract responses
      const responseRegex = /Response:\s*(\d+)(?:\s*\(([^)]+)\))?/g;
      let responseMatch;
      
      while ((responseMatch = responseRegex.exec(detailsText)) !== null) {
        action.responses.push({
          status: parseInt(responseMatch[1].trim(), 10),
          description: responseMatch[2] ? responseMatch[2].trim() : ''
        });
      }
    }
    
    actions.push(action);
  }
  
  return actions;
}

/**
 * Create a structured model from domain entities and API actions
 * @param {Array<Object>} entities - Domain entities
 * @param {Array<Object>} actions - API actions
 * @returns {Object} - Structured model
 */
function createStructuredModel(entities, actions) {
  return {
    entities,
    actions,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0'
    }
  };
}

module.exports = {
  extractDomainEntities,
  extractApiActions,
  createStructuredModel
};
