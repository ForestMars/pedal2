/**
 * API Generator - Converts domain entities into API actions
 * 
 * This script processes a DDD model and generates API specifications
 */

const fs = require('fs');

/**
 * Generate API actions from a DDD model
 * 
 * @param {Object} dddModel - The DDD model content
 * @returns {Object} - The generated API specification
 */
function generateApiActions(dddModel) {
    console.error("Processing DDD Model:", JSON.stringify(dddModel, null, 2));
    
    const apiSpec = {
        openapi: '3.0.0',
        info: {
            title: 'Generated API from DDD Model',
            version: '1.0.0',
            description: 'API generated from domain entities'
        },
        servers: [
            {
                url: '/api',
                description: 'API server'
            }
        ],
        paths: {},
        components: {
            schemas: {}
        }
    };
    
    // Process entities and create API endpoints
    if (dddModel.entities) {
        for (const entity of dddModel.entities) {
            // Create schema component for the entity
            apiSpec.components.schemas[entity.name] = {
                type: 'object',
                properties: {},
                required: []
            };
            
            // Add properties based on entity attributes
            if (entity.attributes) {
                for (const attr of entity.attributes) {
                    // Map entity attribute types to OpenAPI types
                    let type = 'string';
                    let format = undefined;
                    
                    switch (attr.type.toLowerCase()) {
                        case 'number':
                        case 'integer':
                            type = 'integer';
                            break;
                        case 'float':
                        case 'double':
                            type = 'number';
                            format = 'double';
                            break;
                        case 'boolean':
                            type = 'boolean';
                            break;
                        case 'date':
                            type = 'string';
                            format = 'date-time';
                            break;
                        case 'object':
                            type = 'object';
                            break;
                        default:
                            type = 'string';
                    }
                    
                    // Add property to schema
                    apiSpec.components.schemas[entity.name].properties[attr.name] = {
                        type,
                        ...(format ? { format } : {})
                    };
                    
                    // Add to required list if attribute is required
                    if (attr.required) {
                        apiSpec.components.schemas[entity.name].required.push(attr.name);
                    }
                }
            }
            
            // Create plural form of entity name for API paths
            const pluralName = entity.name.endsWith('s') ? entity.name : `${entity.name}s`;
            const pathName = `/${pluralName.toLowerCase()}`;
            
            // Generate CRUD endpoints
            
            // GET collection
            apiSpec.paths[pathName] = {
                get: {
                    summary: `Get all ${pluralName}`,
                    description: `Returns a list of all ${pluralName}`,
                    operationId: `getAll${pluralName}`,
                    parameters: [
                        {
                            name: 'limit',
                            in: 'query',
                            description: 'Maximum number of items to return',
                            required: false,
                            schema: {
                                type: 'integer',
                                default: 20
                            }
                        },
                        {
                            name: 'offset',
                            in: 'query',
                            description: 'Number of items to skip',
                            required: false,
                            schema: {
                                type: 'integer',
                                default: 0
                            }
                        }
                    ],
                    responses: {
                        '200': {
                            description: `A list of ${pluralName}`,
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'array',
                                        items: {
                                            $ref: `#/components/schemas/${entity.name}`
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                post: {
                    summary: `Create a new ${entity.name}`,
                    description: `Creates a new ${entity.name}`,
                    operationId: `create${entity.name}`,
                    requestBody: {
                        description: `${entity.name} object to be created`,
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: `#/components/schemas/${entity.name}`
                                }
                            }
                        }
                    },
                    responses: {
                        '201': {
                            description: `Created ${entity.name}`,
                            content: {
                                'application/json': {
                                    schema: {
                                        $ref: `#/components/schemas/${entity.name}`
                                    }
                                }
                            }
                        },
                        '400': {
                            description: 'Invalid input'
                        }
                    }
                }
            };
            
            // GET, PUT, DELETE for individual resource
            apiSpec.paths[`${pathName}/{id}`] = {
                get: {
                    summary: `Get a ${entity.name} by ID`,
                    description: `Returns a single ${entity.name}`,
                    operationId: `get${entity.name}ById`,
                    parameters: [
                        {
                            name: 'id',
                            in: 'path',
                            description: `ID of the ${entity.name} to retrieve`,
                            required: true,
                            schema: {
                                type: 'string'
                            }
                        }
                    ],
                    responses: {
                        '200': {
                            description: `A ${entity.name} object`,
                            content: {
                                'application/json': {
                                    schema: {
                                        $ref: `#/components/schemas/${entity.name}`
                                    }
                                }
                            }
                        },
                        '404': {
                            description: `${entity.name} not found`
                        }
                    }
                },
                put: {
                    summary: `Update a ${entity.name}`,
                    description: `Updates an existing ${entity.name}`,
                    operationId: `update${entity.name}`,
                    parameters: [
                        {
                            name: 'id',
                            in: 'path',
                            description: `ID of the ${entity.name} to update`,
                            required: true,
                            schema: {
                                type: 'string'
                            }
                        }
                    ],
                    requestBody: {
                        description: `Updated ${entity.name} object`,
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: `#/components/schemas/${entity.name}`
                                }
                            }
                        }
                    },
                    responses: {
                        '200': {
                            description: `Updated ${entity.name}`,
                            content: {
                                'application/json': {
                                    schema: {
                                        $ref: `#/components/schemas/${entity.name}`
                                    }
                                }
                            }
                        },
                        '400': {
                            description: 'Invalid input'
                        },
                        '404': {
                            description: `${entity.name} not found`
                        }
                    }
                },
                delete: {
                    summary: `Delete a ${entity.name}`,
                    description: `Deletes an existing ${entity.name}`,
                    operationId: `delete${entity.name}`,
                    parameters: [
                        {
                            name: 'id',
                            in: 'path',
                            description: `ID of the ${entity.name} to delete`,
                            required: true,
                            schema: {
                                type: 'string'
                            }
                        }
                    ],
                    responses: {
                        '204': {
                            description: 'Successful deletion'
                        },
                        '404': {
                            description: `${entity.name} not found`
                        }
                    }
                }
            };
        }
    }
    
    // Process services and create specialized API endpoints
    if (dddModel.services) {
        for (const service of dddModel.services) {
            const pathName = `/services/${service.name.toLowerCase()}`;
            
            // Create endpoints for service operations
            if (service.operations) {
                apiSpec.paths[pathName] = {};
                
                for (const operation of service.operations) {
                    const operationPath = `${pathName}/${operation.name.toLowerCase()}`;
                    
                    // Create a POST endpoint for the operation
                    apiSpec.paths[operationPath] = {
                        post: {
                            summary: operation.description || `${operation.name} operation`,
                            description: `${service.name} service operation: ${operation.name}`,
                            operationId: operation.name,
                            requestBody: {
                                description: 'Operation parameters',
                                required: true,
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object'
                                        }
                                    }
                                }
                            },
                            responses: {
                                '200': {
                                    description: 'Successful operation',
                                    content: {
                                        'application/json': {
                                            schema: {
                                                type: 'object'
                                            }
                                        }
                                    }
                                },
                                '400': {
                                    description: 'Invalid input'
                                }
                            }
                        }
                    };
                }
            }
        }
    }
    
    return apiSpec;
}

/**
 * Main function that processes the input file and writes the output
 */
function main() {
    if (process.argv.length < 3) {
        console.error('Usage: node api_generator.js <input-file>');
        process.exit(1);
    }
    
    const inputFile = process.argv[2];
    
    try {
        // Read the input file
        const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
        
        // Generate API spec from DDD model
        const result = generateApiActions(input.ddd_model);
        
        // Output the result as JSON
        console.log(JSON.stringify(result));
        
    } catch (error) {
        console.error('Error generating API specification:', error.message);
        process.exit(1);
    }
}

// Run the main function
main();
