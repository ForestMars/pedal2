/**
 * Airflow operator for generating TypeSpec from API models
 */

const { entityToTypeSpec, actionToTypeSpec } = require('../../helpers/type_utils');
const SupabaseHook = require('../hooks/supabase_hook');

class TypeSpecGeneratorOperator {
  constructor(taskId, pipelineRunId, artifactId, stageId) {
    this.taskId = taskId;
    this.pipelineRunId = pipelineRunId;
    this.artifactId = artifactId;
    this.stageId = stageId;
    this.supabaseHook = new SupabaseHook();
  }

  /**
   * Execute the TypeSpec generation task
   * @returns {Promise<Object>} - The execution result
   */
  async execute() {
    try {
      console.log(`Executing TypeSpec generator task: ${this.taskId}`);
      
      // Create stage execution record
      const stageExecution = await this.supabaseHook.createStageExecution({
        pipelineRunId: this.pipelineRunId,
        stageId: this.stageId,
        artifactId: this.artifactId,
        status: 'running'
      });
      
      // Get the API model artifact
      const apiModelArtifact = await this.supabaseHook.getArtifact(this.artifactId);
      if (!apiModelArtifact) {
        throw new Error(`API model artifact with ID ${this.artifactId} not found`);
      }
      
      console.log(`Generating TypeSpec from API model: ${apiModelArtifact.title}`);
      
      // Extract entities and actions from the API model
      const { entities, actions } = apiModelArtifact.content;
      
      // Generate TypeSpec for the entire API
      const typeSpecContent = this.generateTypeSpec(entities, actions, apiModelArtifact.title);
      
      // Create new artifact for TypeSpec
      const typeSpecArtifact = await this.supabaseHook.createArtifact({
        title: `${apiModelArtifact.title} - TypeSpec`,
        description: `TypeSpec generated from ${apiModelArtifact.title}`,
        type: 'TypeSpec',
        content: {
          typeSpecText: typeSpecContent,
          metadata: {
            generatedAt: new Date().toISOString(),
            version: '1.0.0',
            source: apiModelArtifact.id
          }
        },
        version: '1.0.0',
        parentId: apiModelArtifact.id,
        status: 'draft'
      });
      
      // Update stage execution to completed
      await this.supabaseHook.updateStageExecution(stageExecution.id, {
        status: 'completed',
        endTime: new Date(),
        artifactId: typeSpecArtifact.id,
        logs: JSON.stringify({
          message: 'Successfully generated TypeSpec',
          entitiesCount: entities.length,
          actionsCount: actions.length
        })
      });
      
      return {
        status: 'success',
        artifactId: typeSpecArtifact.id,
        stageExecutionId: stageExecution.id
      };
    } catch (error) {
      console.error('Error in TypeSpec generator:', error);
      
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
   * Generate TypeSpec for the entire API
   * @param {Array<Object>} entities - Domain entities
   * @param {Array<Object>} actions - API actions
   * @param {string} title - API title
   * @returns {string} - Complete TypeSpec content
   */
  generateTypeSpec(entities, actions, title) {
    const apiName = title.replace(/[^a-zA-Z0-9]/g, '');
    let typeSpecContent = '';
    
    // Add imports
    typeSpecContent += 'import "@typespec/http";\n';
    typeSpecContent += 'import "@typespec/rest";\n';
    typeSpecContent += 'import "@typespec/openapi";\n\n';
    
    // Add namespace
    typeSpecContent += `@service({title: "${title}"})\n`;
    typeSpecContent += `@server("https://api.example.com", "API Server")\n`;
    typeSpecContent += `namespace ${apiName} {\n\n`;
    
    // Add entities as models
    entities.forEach(entity => {
      typeSpecContent += entityToTypeSpec(entity) + '\n';
    });
    
    // Add response types for actions
    actions.forEach(action => {
      let hasResponse = false;
      
      // Check if action has 200 OK response
      if (action.responses && action.responses.some(r => r.status === 200)) {
        hasResponse = true;
        
        // Find the entity that matches the action name (e.g., getUser -> User)
        const entityName = this.extractEntityNameFromAction(action.name, entities);
        if (entityName) {
          typeSpecContent += `model ${action.name}Response {\n`;
          typeSpecContent += `  data: ${entityName};\n`;
          typeSpecContent += '}\n\n';
        }
      }
    });
    
    // Add interface for API
    typeSpecContent += `@route("/api")\n`;
    typeSpecContent += `interface API {\n`;
    
    // Add operations from actions
    actions.forEach(action => {
      typeSpecContent += actionToTypeSpec(action) + '\n';
    });
    
    typeSpecContent += '}\n\n';
    
    // Close namespace
    typeSpecContent += '}\n';
    
    return typeSpecContent;
  }

  /**
   * Extract entity name from action name
   * @param {string} actionName - Action name (e.g., getUser, createProduct)
   * @param {Array<Object>} entities - Domain entities
   * @returns {string|null} - Entity name or null if not found
   */
  extractEntityNameFromAction(actionName, entities) {
    // Common CRUD prefixes
    const prefixes = ['get', 'create', 'update', 'delete', 'getAll'];
    
    // Try to match each entity name with the action
    for (const entity of entities) {
      const entityName = entity.name;
      
      // Check if action ends with entity name (possibly pluralized)
      if (actionName.endsWith(entityName) || actionName.endsWith(`${entityName}s`)) {
        // Check if action starts with a known prefix
        for (const prefix of prefixes) {
          if (actionName.startsWith(prefix)) {
            return entityName;
          }
        }
      }
    }
    
    return null;
  }
}

module.exports = TypeSpecGeneratorOperator;
