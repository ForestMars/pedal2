/**
 * Utility functions for TypeSpec and type conversion
 */

/**
 * Convert a domain entity to TypeSpec format
 * @param {Object} entity - The domain entity
 * @returns {string} - TypeSpec definition
 */
function entityToTypeSpec(entity) {
  let typeSpec = `model ${entity.name} {\n`;
  
  // Add properties
  entity.properties.forEach(prop => {
    typeSpec += `  ${prop.name}: ${mapTypeToTypeSpec(prop.type)};\n`;
  });
  
  typeSpec += '}\n';
  return typeSpec;
}

/**
 * Convert an API action to TypeSpec format
 * @param {Object} action - The API action
 * @returns {string} - TypeSpec operation definition
 */
function actionToTypeSpec(action) {
  const operationName = action.name;
  const method = action.method.toLowerCase();
  
  let typeSpec = `@route("/${operationName.toLowerCase()}")\n`;
  typeSpec += `@${method}\n`;
  typeSpec += `op ${operationName}(\n`;
  
  // Add parameters
  action.parameters.forEach((param, index) => {
    const isLast = index === action.parameters.length - 1;
    typeSpec += `  @query ${param.name}: ${mapTypeToTypeSpec(param.type)}${isLast ? '' : ','}\n`;
  });
  
  typeSpec += `): `;
  
  // Add response type
  if (action.responses && action.responses.length > 0) {
    // Look for 200 OK response
    const okResponse = action.responses.find(r => r.status === 200);
    if (okResponse) {
      typeSpec += `${action.name}Response;\n`;
    } else {
      typeSpec += `void;\n`;
    }
  } else {
    typeSpec += `void;\n`;
  }
  
  return typeSpec;
}

/**
 * Map common data types to TypeSpec types
 * @param {string} type - Source type
 * @returns {string} - TypeSpec type
 */
function mapTypeToTypeSpec(type) {
  const typeMap = {
    'string': 'string',
    'number': 'numeric',
    'integer': 'int32',
    'boolean': 'boolean',
    'array': 'Array<unknown>',
    'object': 'Record<string, unknown>',
    'date': 'utcDateTime',
    'datetime': 'utcDateTime',
    'uuid': 'string',
    'email': 'string @format("email")'
  };
  
  return typeMap[type.toLowerCase()] || 'string';
}

/**
 * Convert TypeSpec model to Zod schema
 * @param {string} typeSpec - TypeSpec model definition
 * @returns {string} - Zod schema definition
 */
function typeSpecToZod(typeSpec) {
  // Parse the TypeSpec model
  const modelMatch = typeSpec.match(/model\s+(\w+)\s+{([^}]+)}/);
  if (!modelMatch) {
    return '';
  }
  
  const modelName = modelMatch[1];
  const modelBody = modelMatch[2];
  
  // Extract properties
  const properties = [];
  const propRegex = /(\w+):\s+(\w+)(?:\[])?\s*;/g;
  let propMatch;
  
  while ((propMatch = propRegex.exec(modelBody)) !== null) {
    properties.push({
      name: propMatch[1].trim(),
      type: propMatch[2].trim(),
      isArray: propMatch[0].includes('[]')
    });
  }
  
  // Generate Zod schema
  let zodSchema = `const ${modelName}Schema = z.object({\n`;
  
  properties.forEach(prop => {
    let zodType = mapTypeToZod(prop.type);
    if (prop.isArray) {
      zodType = `z.array(${zodType})`;
    }
    
    zodSchema += `  ${prop.name}: ${zodType},\n`;
  });
  
  zodSchema += '});\n';
  return zodSchema;
}

/**
 * Map TypeSpec types to Zod types
 * @param {string} type - TypeSpec type
 * @returns {string} - Zod type
 */
function mapTypeToZod(type) {
  const typeMap = {
    'string': 'z.string()',
    'numeric': 'z.number()',
    'int32': 'z.number().int()',
    'boolean': 'z.boolean()',
    'utcDateTime': 'z.string().datetime()',
    'uuid': 'z.string().uuid()'
  };
  
  return typeMap[type] || 'z.any()';
}

/**
 * Convert TypeSpec model to Drizzle schema
 * @param {string} typeSpec - TypeSpec model definition
 * @returns {string} - Drizzle schema definition
 */
function typeSpecToDrizzle(typeSpec) {
  // Parse the TypeSpec model
  const modelMatch = typeSpec.match(/model\s+(\w+)\s+{([^}]+)}/);
  if (!modelMatch) {
    return '';
  }
  
  const modelName = modelMatch[1];
  const modelBody = modelMatch[2];
  const tableName = modelName.toLowerCase() + 's';
  
  // Extract properties
  const properties = [];
  const propRegex = /(\w+):\s+(\w+)(?:\[])?\s*;/g;
  let propMatch;
  
  while ((propMatch = propRegex.exec(modelBody)) !== null) {
    properties.push({
      name: propMatch[1].trim(),
      type: propMatch[2].trim(),
      isArray: propMatch[0].includes('[]')
    });
  }
  
  // Generate Drizzle schema
  let drizzleSchema = `const ${tableName} = pgTable('${tableName}', {\n`;
  drizzleSchema += `  id: serial('id').primaryKey(),\n`;
  
  properties.forEach(prop => {
    let drizzleType = mapTypeToDrizzle(prop.type, prop.name);
    drizzleSchema += `  ${prop.name}: ${drizzleType},\n`;
  });
  
  drizzleSchema += '});\n';
  return drizzleSchema;
}

/**
 * Map TypeSpec types to Drizzle schema types
 * @param {string} type - TypeSpec type
 * @param {string} propName - Property name
 * @returns {string} - Drizzle type
 */
function mapTypeToDrizzle(type, propName) {
  const typeMap = {
    'string': `text('${propName}')`,
    'numeric': `decimal('${propName}')`,
    'int32': `integer('${propName}')`,
    'boolean': `boolean('${propName}')`,
    'utcDateTime': `timestamp('${propName}')`,
    'uuid': `text('${propName}').uuid()`
  };
  
  return typeMap[type] || `text('${propName}')`;
}

module.exports = {
  entityToTypeSpec,
  actionToTypeSpec,
  typeSpecToZod,
  typeSpecToDrizzle
};
