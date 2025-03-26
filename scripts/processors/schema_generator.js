/**
 * Schema Generator - Generates Zod and Drizzle schemas from TypeSpec files
 * 
 * This script processes TypeSpec code and generates Zod validation schemas and
 * Drizzle database schemas.
 */

const fs = require('fs');

/**
 * Generate Zod and Drizzle schemas from TypeSpec code
 * 
 * @param {Object} typespec - The TypeSpec content and metadata
 * @returns {Object} - The generated Zod and Drizzle schemas
 */
function generateSchemas(typespec) {
    console.error("Processing TypeSpec:", typespec.typespec.substring(0, 500) + "...");
    
    // Parse the TypeSpec code to extract models
    const models = parseTypeSpecModels(typespec.typespec);
    
    // Generate Zod schema
    const zodSchema = generateZodSchema(models, typespec.serviceName);
    
    // Generate Drizzle schema
    const dbSchema = generateDrizzleSchema(models, typespec.serviceName);
    
    return {
        zod_schema: zodSchema,
        db_schema: dbSchema
    };
}

/**
 * Parse TypeSpec code to extract models
 * 
 * @param {string} typespecCode - The TypeSpec code
 * @returns {Array} - Array of parsed model objects
 */
function parseTypeSpecModels(typespecCode) {
    const models = [];
    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    const propertyRegex = /\s*(\w+)(\?)?:\s*([\w\[\]<>|"(),\s.]+);/g;
    
    let modelMatch;
    while ((modelMatch = modelRegex.exec(typespecCode)) !== null) {
        const modelName = modelMatch[1];
        const modelBody = modelMatch[2];
        
        const properties = [];
        let propertyMatch;
        while ((propertyMatch = propertyRegex.exec(modelBody)) !== null) {
            const propName = propertyMatch[1];
            const optional = !!propertyMatch[2];
            const typeName = propertyMatch[3].trim();
            
            properties.push({
                name: propName,
                type: typeName,
                optional
            });
        }
        
        models.push({
            name: modelName,
            properties
        });
    }
    
    return models;
}

/**
 * Generate Zod validation schema from parsed models
 * 
 * @param {Array} models - Array of parsed model objects
 * @param {string} serviceName - The service name
 * @returns {Object} - The generated Zod schema
 */
function generateZodSchema(models, serviceName) {
    let zodCode = `// Generated Zod schema from TypeSpec
import { z } from "zod";

export namespace ${serviceName}Schemas {
`;
    
    // Generate a Zod schema for each model
    for (const model of models) {
        zodCode += `  // ${model.name} schema\n`;
        zodCode += `  export const ${model.name}Schema = z.object({\n`;
        
        for (const prop of model.properties) {
            const zodType = mapTypeSpecTypeToZod(prop.type);
            zodCode += `    ${prop.name}: ${zodType}${prop.optional ? '.optional()' : ''},\n`;
        }
        
        zodCode += `  });\n\n`;
        zodCode += `  export type ${model.name} = z.infer<typeof ${model.name}Schema>;\n\n`;
    }
    
    zodCode += `}\n`;
    
    return {
        code: zodCode,
        models: models.map(m => m.name)
    };
}

/**
 * Generate Drizzle database schema from parsed models
 * 
 * @param {Array} models - Array of parsed model objects
 * @param {string} serviceName - The service name
 * @returns {Object} - The generated Drizzle schema
 */
function generateDrizzleSchema(models, serviceName) {
    let drizzleCode = `// Generated Drizzle schema from TypeSpec
import { pgTable, serial, text, integer, boolean, timestamp, jsonb, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

`;
    
    // Track relationships for creating relation definitions
    const relationships = [];
    
    // Generate a Drizzle table for each model
    for (const model of models) {
        // Convert model name to snake_case for table name
        const tableName = camelToSnakeCase(model.name.toLowerCase());
        
        drizzleCode += `// ${model.name} table\n`;
        drizzleCode += `export const ${tableName} = pgTable("${tableName}", {\n`;
        
        // Always add an id field
        drizzleCode += `  id: serial("id").primaryKey(),\n`;
        
        for (const prop of model.properties) {
            // Skip id property as we've already added it
            if (prop.name === 'id') continue;
            
            const columnType = mapTypeSpecTypeToDrizzle(prop.type);
            const columnName = camelToSnakeCase(prop.name);
            
            // Check if this is a relation field (ends with Id or _id)
            if (prop.name.endsWith('Id') || prop.name.endsWith('_id')) {
                const baseModelName = prop.name.replace(/Id$|_id$/, '');
                const referencedTableName = camelToSnakeCase(baseModelName.toLowerCase());
                
                drizzleCode += `  ${columnName}: integer("${columnName}")`;
                
                // If optional, make nullable
                if (prop.optional) {
                    drizzleCode += `.references(() => ${referencedTableName}.id)`;
                } else {
                    drizzleCode += `.notNull().references(() => ${referencedTableName}.id)`;
                }
                
                // Track this relationship for later
                relationships.push({
                    sourceTable: tableName,
                    targetTable: referencedTableName,
                    sourceColumn: columnName,
                    sourceModelName: model.name,
                    targetModelName: baseModelName,
                    isArray: false
                });
            } else {
                drizzleCode += `  ${columnName}: ${columnType}("${columnName}")`;
                
                // If not optional, make not null
                if (!prop.optional) {
                    drizzleCode += '.notNull()';
                }
            }
            
            drizzleCode += ',\n';
        }
        
        // Add created_at and updated_at fields
        drizzleCode += `  created_at: timestamp("created_at").defaultNow().notNull(),\n`;
        drizzleCode += `  updated_at: timestamp("updated_at").defaultNow().notNull(),\n`;
        
        drizzleCode += `});\n\n`;
    }
    
    // Generate relations
    for (const rel of relationships) {
        drizzleCode += `// Relations for ${rel.sourceModelName}\n`;
        drizzleCode += `export const ${rel.sourceTable}Relations = relations(${rel.sourceTable}, ({ one }) => ({\n`;
        drizzleCode += `  ${rel.targetTable}: one(${rel.targetTable}, {\n`;
        drizzleCode += `    fields: [${rel.sourceTable}.${rel.sourceColumn}],\n`;
        drizzleCode += `    references: [${rel.targetTable}.id],\n`;
        drizzleCode += `  }),\n`;
        drizzleCode += `}));\n\n`;
    }
    
    // Generate type definitions
    for (const model of models) {
        const tableName = camelToSnakeCase(model.name.toLowerCase());
        
        drizzleCode += `// Type definitions for ${model.name}\n`;
        drizzleCode += `export type ${model.name} = typeof ${tableName}.$inferSelect;\n`;
        drizzleCode += `export type New${model.name} = typeof ${tableName}.$inferInsert;\n\n`;
    }
    
    return {
        code: drizzleCode,
        models: models.map(m => m.name)
    };
}

/**
 * Map TypeSpec type to Zod validator
 * 
 * @param {string} typeSpecType - TypeSpec type
 * @returns {string} - Zod validator
 */
function mapTypeSpecTypeToZod(typeSpecType) {
    // Handle array types
    if (typeSpecType.endsWith('[]')) {
        const innerType = typeSpecType.slice(0, -2);
        return `z.array(${mapTypeSpecTypeToZod(innerType)})`;
    }
    
    // Handle union types
    if (typeSpecType.includes('|')) {
        const unionTypes = typeSpecType.split('|').map(t => t.trim());
        return unionTypes.map(mapTypeSpecTypeToZod).join('.or(') + ')'.repeat(unionTypes.length - 1);
    }
    
    // Handle literal string union types
    if (typeSpecType.startsWith('(') && typeSpecType.endsWith(')')) {
        return `z.enum([${typeSpecType.slice(1, -1)}])`;
    }
    
    // Handle basic types
    switch (typeSpecType) {
        case 'string':
            return 'z.string()';
        case 'int32':
        case 'int64':
        case 'float32':
        case 'float64':
            return 'z.number()';
        case 'boolean':
            return 'z.boolean()';
        case 'utcDateTime':
        case 'plainDate':
            return 'z.date()';
        case 'uuid':
            return 'z.string().uuid()';
        case 'Record<string, unknown>':
            return 'z.record(z.string(), z.unknown())';
        default:
            // Assume it's a reference to another schema
            return `${typeSpecType}Schema`;
    }
}

/**
 * Map TypeSpec type to Drizzle column type
 * 
 * @param {string} typeSpecType - TypeSpec type
 * @returns {string} - Drizzle column type
 */
function mapTypeSpecTypeToDrizzle(typeSpecType) {
    // Handle array types
    if (typeSpecType.endsWith('[]')) {
        return 'jsonb';
    }
    
    // Handle union types
    if (typeSpecType.includes('|')) {
        return 'text';
    }
    
    // Handle literal string union types
    if (typeSpecType.startsWith('(') && typeSpecType.endsWith(')')) {
        return 'text';
    }
    
    // Handle basic types
    switch (typeSpecType) {
        case 'string':
            return 'text';
        case 'int32':
        case 'int64':
            return 'integer';
        case 'float32':
        case 'float64':
            return 'numeric';
        case 'boolean':
            return 'boolean';
        case 'utcDateTime':
        case 'plainDate':
            return 'timestamp';
        case 'uuid':
            return 'uuid';
        case 'Record<string, unknown>':
            return 'jsonb';
        default:
            // For complex types, use jsonb
            return 'jsonb';
    }
}

/**
 * Convert camelCase to snake_case
 * 
 * @param {string} str - camelCase string
 * @returns {string} - snake_case string
 */
function camelToSnakeCase(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Main function that processes the input file and writes the output
 */
function main() {
    if (process.argv.length < 3) {
        console.error('Usage: node schema_generator.js <input-file>');
        process.exit(1);
    }
    
    const inputFile = process.argv[2];
    
    try {
        // Read the input file
        const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
        
        // Generate schemas from TypeSpec
        const result = generateSchemas(input.typespec);
        
        // Output the result as JSON
        console.log(JSON.stringify(result));
        
    } catch (error) {
        console.error('Error generating schemas:', error.message);
        process.exit(1);
    }
}

// Run the main function
main();
