/**
 * Airflow hook for interacting with Supabase via Drizzle ORM
 */

const { db } = require('../../shared/db');
const schema = require('../../shared/schema');
const { eq, and } = require('drizzle-orm');

class SupabaseHook {
  constructor() {
    this.db = db;
    this.schema = schema;
  }

  /**
   * Create a new artifact
   * @param {Object} artifactData - The artifact data to insert
   * @returns {Promise<Object>} - The created artifact
   */
  async createArtifact(artifactData) {
    try {
      const [artifact] = await this.db
        .insert(this.schema.artifacts)
        .values(artifactData)
        .returning();
      
      return artifact;
    } catch (error) {
      console.error('Error creating artifact:', error);
      throw error;
    }
  }

  /**
   * Get an artifact by ID
   * @param {number} id - The artifact ID
   * @returns {Promise<Object|null>} - The artifact or null if not found
   */
  async getArtifact(id) {
    try {
      const [artifact] = await this.db
        .select()
        .from(this.schema.artifacts)
        .where(eq(this.schema.artifacts.id, id));
      
      return artifact || null;
    } catch (error) {
      console.error('Error getting artifact:', error);
      throw error;
    }
  }

  /**
   * Update an artifact
   * @param {number} id - The artifact ID
   * @param {Object} data - The data to update
   * @returns {Promise<Object>} - The updated artifact
   */
  async updateArtifact(id, data) {
    try {
      const [updatedArtifact] = await this.db
        .update(this.schema.artifacts)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(this.schema.artifacts.id, id))
        .returning();
      
      return updatedArtifact;
    } catch (error) {
      console.error('Error updating artifact:', error);
      throw error;
    }
  }

  /**
   * Create a new pipeline run
   * @returns {Promise<Object>} - The created pipeline run
   */
  async createPipelineRun() {
    try {
      const [pipelineRun] = await this.db
        .insert(this.schema.pipelineRuns)
        .values({ startTime: new Date(), status: 'running' })
        .returning();
      
      return pipelineRun;
    } catch (error) {
      console.error('Error creating pipeline run:', error);
      throw error;
    }
  }

  /**
   * Update a pipeline run
   * @param {number} id - The pipeline run ID
   * @param {Object} data - The data to update
   * @returns {Promise<Object>} - The updated pipeline run
   */
  async updatePipelineRun(id, data) {
    try {
      const [updatedRun] = await this.db
        .update(this.schema.pipelineRuns)
        .set(data)
        .where(eq(this.schema.pipelineRuns.id, id))
        .returning();
      
      return updatedRun;
    } catch (error) {
      console.error('Error updating pipeline run:', error);
      throw error;
    }
  }

  /**
   * Create a stage execution
   * @param {Object} executionData - The execution data
   * @returns {Promise<Object>} - The created stage execution
   */
  async createStageExecution(executionData) {
    try {
      const [execution] = await this.db
        .insert(this.schema.stageExecutions)
        .values(executionData)
        .returning();
      
      return execution;
    } catch (error) {
      console.error('Error creating stage execution:', error);
      throw error;
    }
  }

  /**
   * Update a stage execution
   * @param {number} id - The stage execution ID
   * @param {Object} data - The data to update
   * @returns {Promise<Object>} - The updated stage execution
   */
  async updateStageExecution(id, data) {
    try {
      const [updatedExecution] = await this.db
        .update(this.schema.stageExecutions)
        .set(data)
        .where(eq(this.schema.stageExecutions.id, id))
        .returning();
      
      return updatedExecution;
    } catch (error) {
      console.error('Error updating stage execution:', error);
      throw error;
    }
  }

  /**
   * Create sign-off requests for a stage execution
   * @param {number} stageExecutionId - The stage execution ID
   * @param {Array<number>} stakeholderIds - Array of stakeholder IDs
   * @returns {Promise<Array<Object>>} - The created sign-off requests
   */
  async createSignOffRequests(stageExecutionId, stakeholderIds) {
    try {
      const signOffData = stakeholderIds.map(stakeholderId => ({
        stageExecutionId,
        stakeholderId,
        status: 'pending'
      }));

      const signOffs = await this.db
        .insert(this.schema.signOffs)
        .values(signOffData)
        .returning();
      
      return signOffs;
    } catch (error) {
      console.error('Error creating sign-off requests:', error);
      throw error;
    }
  }

  /**
   * Update a sign-off request
   * @param {number} id - The sign-off ID
   * @param {string} status - The new status (approved/rejected)
   * @param {string} comments - Optional comments
   * @returns {Promise<Object>} - The updated sign-off
   */
  async updateSignOff(id, status, comments = null) {
    try {
      const [updatedSignOff] = await this.db
        .update(this.schema.signOffs)
        .set({
          status,
          comments,
          timestamp: new Date()
        })
        .where(eq(this.schema.signOffs.id, id))
        .returning();
      
      return updatedSignOff;
    } catch (error) {
      console.error('Error updating sign-off:', error);
      throw error;
    }
  }

  /**
   * Check if all required sign-offs are approved for a stage execution
   * @param {number} stageExecutionId - The stage execution ID
   * @returns {Promise<boolean>} - Whether all sign-offs are approved
   */
  async areAllSignOffsApproved(stageExecutionId) {
    try {
      const signOffs = await this.db
        .select()
        .from(this.schema.signOffs)
        .where(eq(this.schema.signOffs.stageExecutionId, stageExecutionId));
      
      if (signOffs.length === 0) {
        return false;
      }
      
      // Check if any sign-offs are pending or rejected
      return !signOffs.some(signOff => signOff.status !== 'approved');
    } catch (error) {
      console.error('Error checking sign-offs:', error);
      throw error;
    }
  }

  /**
   * Get all stages for the pipeline
   * @returns {Promise<Array<Object>>} - The pipeline stages
   */
  async getPipelineStages() {
    try {
      const stages = await this.db
        .select()
        .from(this.schema.pipelineStages)
        .orderBy(this.schema.pipelineStages.order);
      
      return stages;
    } catch (error) {
      console.error('Error getting pipeline stages:', error);
      throw error;
    }
  }
}

module.exports = SupabaseHook;
