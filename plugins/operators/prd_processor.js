/**
 * Airflow operator for processing PRD documents and extracting domain entities
 */

const { extractDomainEntities, extractApiActions, createStructuredModel } = require('../../helpers/document_parser');
const SupabaseHook = require('../hooks/supabase_hook');

class PrdProcessorOperator {
  constructor(taskId, pipelineRunId, artifactId, stageId) {
    this.taskId = taskId;
    this.pipelineRunId = pipelineRunId;
    this.artifactId = artifactId;
    this.stageId = stageId;
    this.supabaseHook = new SupabaseHook();
  }

  /**
   * Execute the PRD processing task
   * @returns {Promise<Object>} - The execution result
   */
  async execute() {
    try {
      console.log(`Executing PRD processor task: ${this.taskId}`);
      
      // Create stage execution record
      const stageExecution = await this.supabaseHook.createStageExecution({
        pipelineRunId: this.pipelineRunId,
        stageId: this.stageId,
        artifactId: this.artifactId,
        status: 'running'
      });
      
      // Get the PRD artifact
      const prdArtifact = await this.supabaseHook.getArtifact(this.artifactId);
      if (!prdArtifact) {
        throw new Error(`PRD artifact with ID ${this.artifactId} not found`);
      }
      
      console.log(`Processing PRD: ${prdArtifact.title}`);
      
      // Extract domain entities and API actions
      const domainEntities = extractDomainEntities(prdArtifact.content);
      const apiActions = extractApiActions(prdArtifact.content);
      
      // Create structured model
      const structuredModel = createStructuredModel(domainEntities, apiActions);
      
      // Create new artifact for domain model
      const domainModelArtifact = await this.supabaseHook.createArtifact({
        title: `${prdArtifact.title} - Domain Model`,
        description: `Domain model extracted from ${prdArtifact.title}`,
        type: 'DDD',
        content: structuredModel,
        version: '1.0.0',
        parentId: prdArtifact.id,
        status: 'draft'
      });
      
      // Update stage execution to completed
      await this.supabaseHook.updateStageExecution(stageExecution.id, {
        status: 'completed',
        endTime: new Date(),
        artifactId: domainModelArtifact.id,
        logs: JSON.stringify({
          message: 'Successfully extracted domain model',
          entitiesCount: domainEntities.length,
          actionsCount: apiActions.length
        })
      });
      
      return {
        status: 'success',
        artifactId: domainModelArtifact.id,
        stageExecutionId: stageExecution.id
      };
    } catch (error) {
      console.error('Error in PRD processor:', error);
      
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
}

module.exports = PrdProcessorOperator;
