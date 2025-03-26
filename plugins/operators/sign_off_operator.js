/**
 * Airflow operator for handling stakeholder sign-offs
 */

const SupabaseHook = require('../hooks/supabase_hook');

class SignOffOperator {
  constructor(taskId, pipelineRunId, artifactId, stageId, stakeholderIds) {
    this.taskId = taskId;
    this.pipelineRunId = pipelineRunId;
    this.artifactId = artifactId;
    this.stageId = stageId;
    this.stakeholderIds = stakeholderIds || [];
    this.supabaseHook = new SupabaseHook();
  }

  /**
   * Execute the sign-off task
   * @returns {Promise<Object>} - The execution result
   */
  async execute() {
    try {
      console.log(`Executing sign-off task: ${this.taskId}`);
      
      // Create stage execution record
      const stageExecution = await this.supabaseHook.createStageExecution({
        pipelineRunId: this.pipelineRunId,
        stageId: this.stageId,
        artifactId: this.artifactId,
        status: 'waiting_approval'
      });
      
      // Get the artifact
      const artifact = await this.supabaseHook.getArtifact(this.artifactId);
      if (!artifact) {
        throw new Error(`Artifact with ID ${this.artifactId} not found`);
      }
      
      console.log(`Waiting for sign-offs on artifact: ${artifact.title}`);
      
      // Create sign-off requests for stakeholders
      await this.supabaseHook.createSignOffRequests(stageExecution.id, this.stakeholderIds);
      
      // This is an async operation - in a real implementation, this would use a 
      // sensor or external trigger to wait for approvals to be complete
      // For this implementation, we'll just set up the sign-off requests and return
      
      return {
        status: 'waiting_approval',
        artifactId: this.artifactId,
        stageExecutionId: stageExecution.id
      };
    } catch (error) {
      console.error('Error in sign-off operator:', error);
      
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
   * Check if all required sign-offs are complete
   * @param {number} stageExecutionId - Stage execution ID
   * @returns {Promise<boolean>} - Whether all sign-offs are complete
   */
  async checkSignOffsComplete(stageExecutionId) {
    return await this.supabaseHook.areAllSignOffsApproved(stageExecutionId);
  }

  /**
   * Complete the sign-off task (called when all approvals are received)
   * @param {number} stageExecutionId - Stage execution ID
   * @returns {Promise<Object>} - The execution result
   */
  async completeTask(stageExecutionId) {
    try {
      // Update stage execution to completed
      await this.supabaseHook.updateStageExecution(stageExecutionId, {
        status: 'completed',
        endTime: new Date(),
        logs: JSON.stringify({
          message: 'All stakeholders have approved'
        })
      });
      
      return {
        status: 'success',
        artifactId: this.artifactId,
        stageExecutionId
      };
    } catch (error) {
      console.error('Error completing sign-off task:', error);
      throw error;
    }
  }
}

module.exports = SignOffOperator;
