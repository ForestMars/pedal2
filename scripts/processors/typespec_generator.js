/**
 * TypeSpec Generator - Generates TypeSpec files from API specifications
 * 
 * This script processes an OpenAPI specification and generates TypeSpec code
 */

const fs = require('fs');

/**
 * Generate TypeSpec code from an OpenAPI specification
 * 
 * @param {Object} apiSpec - The OpenAPI specification
 * @returns {Object} - The generated TypeSpec code and metadata
 */
function generateTypeSpec(apiSpec) {
    console.error("Processing API Spec:", JSON.stringify(apiSpec, null, 2));
    
    let typespecCode = `// Generated TypeSpec from OpenAPI specification
// API: ${apiSpec.info?.title || 'Generated API'}
// Version: ${apiSpec.info?.version || '1.0.0'}

import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";

@service({
  title: "${apiSpec.info?.title || 'Generated API'}",
  version: "${apiSpec.info?.version || '1.0.0'}"
})
namespace ${convertToValidIdentifier(apiSpec.info?.title || 'GeneratedApi')} {
  using TypeSpec.Http;
  using TypeSpec.Rest;
  using TypeSpec.OpenAPI;

`;

    // Generate models from schemas
    const models = [];
    if (apiSpec.components?.schemas) {
        for (const [schemaName, schema] of Object.entries(apiSpec.components.schemas)) {
            models.push(schemaName);
            
            typespecCode += `  // Model: ${schemaName}\n`;
            typespecCode += `  model ${schemaName} {\n`;
            
            // Process properties
            if (schema.properties) {
                for (const [propName, prop] of Object.entries(schema.properties)) {
                    const required = schema.required?.includes(propName);
                    const typespecType = mapOpenApiTypeToTypeSpec(prop);
                    typespecCode += `    ${propName}${required ? '' : '?'}: ${typespecType};\n`;
                }
            }
            
            typespecCode += `  }\n\n`;
        }
    }
    
    // Generate operations from paths
    if (apiSpec.paths) {
        for (const [path, pathItem] of Object.entries(apiSpec.paths)) {
            for (const [method, operation] of Object.entries(pathItem)) {
                if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
                    const operationId = operation.operationId || `${method}${convertPathToOperationName(path)}`;
                    
                    typespecCode += `  // Operation: ${operationId}\n`;
                    typespecCode += `  @route("${path}")\n`;
                    typespecCode += `  @${method}\n`;
                    
                    // Determine operation parameters
                    let params = [];
                    let requestBodyParam = null;
                    
                    // Path parameters
                    if (operation.parameters) {
                        for (const param of operation.parameters) {
                            if (param.in === 'path') {
                                const paramType = mapOpenApiTypeToTypeSpec(param.schema);
                                params.push(`@path ${param.name}: ${paramType}`);
                            } else if (param.in === 'query') {
                                const paramType = mapOpenApiTypeToTypeSpec(param.schema);
                                const optional = !param.required;
                                params.push(`@query ${param.name}${optional ? '?' : ''}: ${paramType}`);
                            }
                        }
                    }
                    
                    // Request body
                    if (operation.requestBody) {
                        const contentType = operation.requestBody.content?.['application/json'];
                        if (contentType) {
                            const schema = contentType.schema;
                            if (schema.$ref) {
                                const modelName = schema.$ref.split('/').pop();
                                requestBodyParam = `@body body: ${modelName}`;
                            } else {
                                requestBodyParam = `@body body: object`;
                            }
                        }
                    }
                    
                    // Determine return type
                    let returnType = 'void';
                    if (operation.responses) {
                        const successResponse = operation.responses['200'] || operation.responses['201'];
                        if (successResponse) {
                            const content = successResponse.content?.['application/json'];
                            if (content) {
                                const schema = content.schema;
                                if (schema.$ref) {
                                    returnType = schema.$ref.split('/').pop();
                                } else if (schema.type === 'array' && schema.items.$ref) {
                                    returnType = `${schema.items.$ref.split('/').pop()}[]`;
                                } else if (schema.type) {
                                    returnType = mapOpenApiTypeToTypeSpec(schema);
                                }
                            }
                        }
                    }
                    
                    // Build the operation signature
                    let allParams = [...params];
                    if (requestBodyParam) {
                        allParams.push(requestBodyParam);
                    }
                    
                    typespecCode += `  op ${operationId}(${allParams.join(', ')}): ${returnType};\n\n`;
                }
            }
        }
    }
    
    typespecCode += `}\n`;
    
    return {
        typespec: typespecCode,
        models: models,
        serviceName: convertToValidIdentifier(apiSpec.info?.title || 'GeneratedApi')
    };
}

/**
 * Map OpenAPI type to TypeSpec type
 * 
 * @param {Object} schema - OpenAPI schema object
 * @returns {string} - TypeSpec type
 */
function mapOpenApiTypeToTypeSpec(schema) {
    if (!schema) return 'string';
    
    if (schema.$ref) {
        return schema.$ref.split('/').pop();
    }
    
    switch (schema.type) {
        case 'integer':
            return 'int32';
        case 'number':
            return schema.format === 'float' ? 'float32' : 'float64';
        case 'boolean':
            return 'boolean';
        case 'array':
            const itemType = schema.items ? mapOpenApiTypeToTypeSpec(schema.items) : 'string';
            return `${itemType}[]`;
        case 'object':
            return 'Record<string, unknown>';
        case 'string':
            if (schema.format === 'date-time') return 'utcDateTime';
            if (schema.format === 'date') return 'plainDate';
            if (schema.format === 'uuid') return 'uuid';
            if (schema.enum) return `("${schema.enum.join('" | "')}")`;
            return 'string';
        default:
            return 'string';
    }
}

/**
 * Convert a string to a valid TypeSpec identifier
 * 
 * @param {string} str - Input string
 * @returns {string} - Valid TypeSpec identifier
 */
function convertToValidIdentifier(str) {
    // Remove special characters and replace spaces with CamelCase
    return str
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .split(' ')
        .map((word, index) => {
            if (index === 0) {
                // First word starts with uppercase
                return word.charAt(0).toUpperCase() + word.slice(1);
            }
            // Capitalize first letter of each subsequent word for camelCase
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join('');
}

/**
 * Convert a path to an operation name
 * 
 * @param {string} path - API path
 * @returns {string} - Operation name
 */
function convertPathToOperationName(path) {
    // Remove leading slash and parameters
    const pathWithoutParams = path.replace(/\/{[^}]+}/g, '');
    
    // Split by slashes and convert to camelCase
    return pathWithoutParams
        .split('/')
        .filter(part => part.length > 0)
        .map((part, index) => {
            if (index === 0) {
                return part;
            }
            return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join('');
}

/**
 * Main function that processes the input file and writes the output
 */
function main() {
    if (process.argv.length < 3) {
        console.error('Usage: node typespec_generator.js <input-file>');
        process.exit(1);
    }
    
    const inputFile = process.argv[2];
    
    try {
        // Read the input file
        const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
        
        // Generate TypeSpec from API spec
        const result = generateTypeSpec(input.api_spec);
        
        // Output the result as JSON
        console.log(JSON.stringify(result));
        
    } catch (error) {
        console.error('Error generating TypeSpec:', error.message);
        process.exit(1);
    }
}

// Run the main function
main();
