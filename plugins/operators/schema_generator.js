/**
 * Airflow operator for generating Zod and Drizzle schemas from TypeSpec
 */

const { typeSpecToZod, typeSpecToDrizzle } = require('../../helpers/type_utils');
const SupabaseHook = require('../hooks/supabase_hook');

class SchemaGeneratorOperator {
  constructor(taskId, pipelineRunId, artifactId, stageId) {
    this.taskId = taskId;
    this.pipelineRunId = pipelineRunId;
    this.artifactId = artifactId;
    this.stageId = stageId;
    this.supabaseHook = new SupabaseHook();
  }

  /**
   * Execute the schema generation task
   * @returns {Promise<Object>} - The execution result
   */
  async execute() {
    try {
      console.log(`Executing schema generator task: ${this.taskId}`);
      
      // Create stage execution record
      const stageExecution = await this.supabaseHook.createStageExecution({
        pipelineRunId: this.pipelineRunId,
        stageId: this.stageId,
        artifactId: this.artifactId,
        status: 'running'
      });
      
      // Get the TypeSpec artifact
      const typeSpecArtifact = await this.supabaseHook.getArtifact(this.artifactId);
      if (!typeSpecArtifact) {
        throw new Error(`TypeSpec artifact with ID ${this.artifactId} not found`);
      }
      
      console.log(`Generating schemas from TypeSpec: ${typeSpecArtifact.title}`);
      
      // Extract TypeSpec content
      const { typeSpecText } = typeSpecArtifact.content;
      
      // Generate Zod schemas
      const zodSchemas = this.generateZodSchemas(typeSpecText);
      
      // Generate Drizzle schemas
      const drizzleSchemas = this.generateDrizzleSchemas(typeSpecText);
      
      // Create new artifact for schemas
      const schemaArtifact = await this.supabaseHook.createArtifact({
        title: `${typeSpecArtifact.title} - Schemas`,
        description: `Zod and Drizzle schemas generated from ${typeSpecArtifact.title}`,
        type: 'Schema',
        content: {
          zodSchemas,
          drizzleSchemas,
          metadata: {
            generatedAt: new Date().toISOString(),
            version: '1.0.0',
            source: typeSpecArtifact.id
          }
        },
        version: '1.0.0',
        parentId: typeSpecArtifact.id,
        status: 'draft'
      });
      
      // Update stage execution to completed
      await this.supabaseHook.updateStageExecution(stageExecution.id, {
        status: 'completed',
        endTime: new Date(),
        artifactId: schemaArtifact.id,
        logs: JSON.stringify({
          message: 'Successfully generated schemas',
          zodSchemasCount: Object.keys(zodSchemas).length,
          drizzleSchemasCount: Object.keys(drizzleSchemas).length
        })
      });
      
      return {
        status: 'success',
        artifactId: schemaArtifact.id,
        stageExecutionId: stageExecution.id
      };
    } catch (error) {
      console.error('Error in schema generator:', error);
      
      // Update stage execution to failed
      if (this.stageExecution) {
        await this.supabaseHook.updateStageExecution(this.stageExecution.id, {
          status: 'failed',
          endTime: new Date(),
          logs: JSON.stringify({
            error: error.message,
            stack: error.stack
          })
        });
      }
      
      throw error;
    }
  }

  /**
   * Generate Zod schemas from TypeSpec
   * @param {string} typeSpecText - TypeSpec content
   * @returns {Object} - Zod schemas for each model
   */
  generateZodSchemas(typeSpecText) {
    const zodSchemas = {};
    
    // Extract models from TypeSpec
    const modelRegex = /model\s+(\w+)\s+{([^}]+)}/g;
    let modelMatch;
    
    while ((modelMatch = modelRegex.exec(typeSpecText)) !== null) {
      const modelName = modelMatch[1];
      const modelDefinition = modelMatch[0];
      
      // Convert model to Zod schema
      const zodSchema = typeSpecToZod(modelDefinition);
      
      // Store schema
      zodSchemas[modelName] = zodSchema;
    }
    
    return zodSchemas;
  }

  /**
   * Generate Drizzle schemas from TypeSpec
   * @param {string} typeSpecText - TypeSpec content
   * @returns {Object} - Drizzle schemas for each model
   */
  generateDrizzleSchemas(typeSpecText) {
    const drizzleSchemas = {};
    
    // Extract models from TypeSpec
    const modelRegex = /model\s+(\w+)\s+{([^}]+)}/g;
    let modelMatch;
    
    while ((modelMatch = modelRegex.exec(typeSpecText)) !== null) {
      const modelName = modelMatch[1];
      const modelDefinition = modelMatch[0];
      
      // Convert model to Drizzle schema
      const drizzleSchema = typeSpecToDrizzle(modelDefinition);
      
      // Store schema
      drizzleSchemas[modelName] = drizzleSchema;
    }
    
    return drizzleSchemas;
  }
}

module.exports = SchemaGeneratorOperator;
