/**
 * Airflow operator for converting domain models to API actions
 */

const SupabaseHook = require('../hooks/supabase_hook');

class ApiActionConverterOperator {
  constructor(taskId, pipelineRunId, artifactId, stageId) {
    this.taskId = taskId;
    this.pipelineRunId = pipelineRunId;
    this.artifactId = artifactId;
    this.stageId = stageId;
    this.supabaseHook = new SupabaseHook();
  }

  /**
   * Execute the API action conversion task
   * @returns {Promise<Object>} - The execution result
   */
  async execute() {
    try {
      console.log(`Executing API action converter task: ${this.taskId}`);
      
      // Create stage execution record
      const stageExecution = await this.supabaseHook.createStageExecution({
        pipelineRunId: this.pipelineRunId,
        stageId: this.stageId,
        artifactId: this.artifactId,
        status: 'running'
      });
      
      // Get the domain model artifact
      const domainModelArtifact = await this.supabaseHook.getArtifact(this.artifactId);
      if (!domainModelArtifact) {
        throw new Error(`Domain model artifact with ID ${this.artifactId} not found`);
      }
      
      console.log(`Converting domain model to API actions: ${domainModelArtifact.title}`);
      
      // Extract domain entities and existing actions from the model
      const { entities, actions: existingActions } = domainModelArtifact.content;
      
      // Generate API actions for each entity
      const apiActions = this.generateApiActions(entities, existingActions);
      
      // Create a new structured model with the generated API actions
      const apiModel = {
        entities,
        actions: apiActions,
        metadata: {
          generatedAt: new Date().toISOString(),
          version: '1.0.0',
          source: domainModelArtifact.id
        }
      };
      
      // Create new artifact for API model
      const apiModelArtifact = await this.supabaseHook.createArtifact({
        title: `${domainModelArtifact.title} - API Model`,
        description: `API model generated from ${domainModelArtifact.title}`,
        type: 'API',
        content: apiModel,
        version: '1.0.0',
        parentId: domainModelArtifact.id,
        status: 'draft'
      });
      
      // Update stage execution to completed
      await this.supabaseHook.updateStageExecution(stageExecution.id, {
        status: 'completed',
        endTime: new Date(),
        artifactId: apiModelArtifact.id,
        logs: JSON.stringify({
          message: 'Successfully generated API actions',
          entitiesCount: entities.length,
          actionsCount: apiActions.length
        })
      });
      
      return {
        status: 'success',
        artifactId: apiModelArtifact.id,
        stageExecutionId: stageExecution.id
      };
    } catch (error) {
      console.error('Error in API action converter:', error);
      
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
   * Generate standard API actions for domain entities
   * @param {Array<Object>} entities - Domain entities
   * @param {Array<Object>} existingActions - Existing API actions
   * @returns {Array<Object>} - Complete set of API actions
   */
  generateApiActions(entities, existingActions = []) {
    const generatedActions = [];
    
    // Preserve existing actions
    generatedActions.push(...existingActions);
    
    // Generate standard CRUD operations for each entity
    entities.forEach(entity => {
      const entityName = entity.name;
      
      // Check if actions already exist for this entity
      const hasGetAll = existingActions.some(a => a.name === `getAll${entityName}s`);
      const hasGet = existingActions.some(a => a.name === `get${entityName}`);
      const hasCreate = existingActions.some(a => a.name === `create${entityName}`);
      const hasUpdate = existingActions.some(a => a.name === `update${entityName}`);
      const hasDelete = existingActions.some(a => a.name === `delete${entityName}`);
      
      // GET all (collection)
      if (!hasGetAll) {
        generatedActions.push({
          name: `getAll${entityName}s`,
          method: 'GET',
          parameters: [
            {
              name: 'limit',
              type: 'integer',
              description: 'Maximum number of items to return'
            },
            {
              name: 'offset',
              type: 'integer',
              description: 'Number of items to skip'
            }
          ],
          responses: [
            {
              status: 200,
              description: `List of ${entityName} objects`
            }
          ]
        });
      }
      
      // GET by ID (single item)
      if (!hasGet) {
        generatedActions.push({
          name: `get${entityName}`,
          method: 'GET',
          parameters: [
            {
              name: 'id',
              type: 'string',
              description: `ID of the ${entityName} to retrieve`
            }
          ],
          responses: [
            {
              status: 200,
              description: `${entityName} object`
            },
            {
              status: 404,
              description: `${entityName} not found`
            }
          ]
        });
      }
      
      // POST (create)
      if (!hasCreate) {
        generatedActions.push({
          name: `create${entityName}`,
          method: 'POST',
          parameters: entity.properties.map(prop => ({
            name: prop.name,
            type: prop.type,
            description: `${prop.name} of the ${entityName}`
          })),
          responses: [
            {
              status: 201,
              description: `Created ${entityName} object`
            },
            {
              status: 400,
              description: 'Invalid input'
            }
          ]
        });
      }
      
      // PUT (update)
      if (!hasUpdate) {
        generatedActions.push({
          name: `update${entityName}`,
          method: 'PUT',
          parameters: [
            {
              name: 'id',
              type: 'string',
              description: `ID of the ${entityName} to update`
            },
            ...entity.properties.map(prop => ({
              name: prop.name,
              type: prop.type,
              description: `${prop.name} of the ${entityName}`
            }))
          ],
          responses: [
            {
              status: 200,
              description: `Updated ${entityName} object`
            },
            {
              status: 404,
              description: `${entityName} not found`
            },
            {
              status: 400,
              description: 'Invalid input'
            }
          ]
        });
      }
      
      // DELETE
      if (!hasDelete) {
        generatedActions.push({
          name: `delete${entityName}`,
          method: 'DELETE',
          parameters: [
            {
              name: 'id',
              type: 'string',
              description: `ID of the ${entityName} to delete`
            }
          ],
          responses: [
            {
              status: 204,
              description: 'No content'
            },
            {
              status: 404,
              description: `${entityName} not found`
            }
          ]
        });
      }
    });
    
    return generatedActions;
  }
}

module.exports = ApiActionConverterOperator;
