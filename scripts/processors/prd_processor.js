/**
 * PRD Processor - Extracts domain entities from a Product Requirements Document
 * 
 * This script processes a PRD and extracts domain entities for a DDD model
 */

const fs = require('fs');

/**
 * Extract domain entities from a PRD
 * 
 * @param {Object} prd - The PRD content
 * @returns {Object} - The extracted domain entities
 */
function extractDomainEntities(prd) {
    console.error("Processing PRD:", JSON.stringify(prd, null, 2));
    
    // This is a simplified implementation
    // In a real-world scenario, this would use NLP or other techniques to extract entities
    
    const entities = [];
    const aggregates = [];
    const valueObjects = [];
    const services = [];
    
    // Extract entities from the requirements
    if (prd.requirements) {
        for (const req of prd.requirements) {
            // Look for nouns that could be entities
            const reqText = req.description || '';
            
            // Extract potential entities from text (simplified)
            const words = reqText.split(/\s+/);
            const potentialEntities = words
                .filter(word => word.length > 3)
                .filter(word => word[0] === word[0].toUpperCase())
                .map(word => word.replace(/[.,;:!?()]/g, ''))
                .filter(word => word.length > 0);
            
            // Add unique entities
            for (const entity of potentialEntities) {
                if (!entities.some(e => e.name === entity)) {
                    entities.push({
                        name: entity,
                        attributes: [],
                        description: `Entity extracted from requirement: ${req.id}`
                    });
                }
            }
        }
    }
    
    // For demo purposes, let's add some default entities if none were extracted
    if (entities.length === 0) {
        if (prd.title && prd.title.includes('User')) {
            entities.push({
                name: 'User',
                attributes: [
                    { name: 'id', type: 'string', required: true },
                    { name: 'username', type: 'string', required: true },
                    { name: 'email', type: 'string', required: true },
                    { name: 'createdAt', type: 'Date', required: true }
                ],
                description: 'User entity representing a system user'
            });
        }
        
        entities.push({
            name: 'Artifact',
            attributes: [
                { name: 'id', type: 'string', required: true },
                { name: 'name', type: 'string', required: true },
                { name: 'type', type: 'string', required: true },
                { name: 'content', type: 'object', required: true },
                { name: 'version', type: 'number', required: true },
                { name: 'createdAt', type: 'Date', required: true },
                { name: 'updatedAt', type: 'Date', required: true },
                { name: 'createdBy', type: 'string', required: true }
            ],
            description: 'Artifact entity representing a deliverable in the system'
        });
        
        entities.push({
            name: 'Approval',
            attributes: [
                { name: 'id', type: 'string', required: true },
                { name: 'artifactId', type: 'string', required: true },
                { name: 'stakeholderId', type: 'string', required: true },
                { name: 'status', type: 'string', required: true },
                { name: 'comment', type: 'string', required: false },
                { name: 'createdAt', type: 'Date', required: true },
                { name: 'updatedAt', type: 'Date', required: true }
            ],
            description: 'Approval entity representing stakeholder approval of an artifact'
        });
    }
    
    // Create aggregates based on entities
    if (entities.length > 0) {
        aggregates.push({
            name: 'ArtifactAggregate',
            rootEntity: 'Artifact',
            entities: ['Artifact', 'Approval'],
            description: 'Aggregate root for artifacts and their approvals'
        });
    }
    
    // Create value objects
    valueObjects.push({
        name: 'ArtifactContent',
        attributes: [
            { name: 'data', type: 'object', required: true },
            { name: 'format', type: 'string', required: true }
        ],
        description: 'Value object representing the content of an artifact'
    });
    
    // Create services
    services.push({
        name: 'ArtifactProcessingService',
        operations: [
            { name: 'processArtifact', description: 'Process an artifact and move it to the next stage' },
            { name: 'approveArtifact', description: 'Approve an artifact' },
            { name: 'rejectArtifact', description: 'Reject an artifact' }
        ],
        description: 'Service for processing artifacts in the delivery pipeline'
    });
    
    return {
        entities,
        aggregates,
        valueObjects,
        services,
        boundedContexts: [
            {
                name: 'ArtifactDelivery',
                entities: entities.map(e => e.name),
                aggregates: aggregates.map(a => a.name),
                valueObjects: valueObjects.map(v => v.name),
                services: services.map(s => s.name),
                description: 'Bounded context for artifact delivery process'
            }
        ]
    };
}

/**
 * Main function that processes the input file and writes the output
 */
function main() {
    if (process.argv.length < 3) {
        console.error('Usage: node prd_processor.js <input-file>');
        process.exit(1);
    }
    
    const inputFile = process.argv[2];
    
    try {
        // Read the input file
        const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
        
        // Process the PRD
        const result = extractDomainEntities(input.prd);
        
        // Output the result as JSON
        console.log(JSON.stringify(result));
        
    } catch (error) {
        console.error('Error processing PRD:', error.message);
        process.exit(1);
    }
}

// Run the main function
main();
