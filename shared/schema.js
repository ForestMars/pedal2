/**
 * Database schema definitions using Drizzle ORM
 */

const { pgTable, serial, text, timestamp, integer, boolean, json } = require('drizzle-orm/pg-core');
const { relations } = require('drizzle-orm');

// Artifacts table - stores all artifacts in the pipeline
const artifacts = pgTable('artifacts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  type: text('type').notNull(), // PRD, DDD, API, TypeSpec, Schema
  content: json('content').notNull(),
  version: text('version').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  parentId: integer('parent_id').references(() => artifacts.id),
  status: text('status').notNull().default('draft'), // draft, in_review, approved, rejected
});

// Define self-relation for artifacts
const artifactsRelations = relations(artifacts, ({ one }) => ({
  parent: one(artifacts, {
    fields: [artifacts.parentId],
    references: [artifacts.id],
  }),
}));

// Pipeline stages
const pipelineStages = pgTable('pipeline_stages', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  order: integer('order').notNull(),
  requiresApproval: boolean('requires_approval').default(true).notNull(),
  operatorClass: text('operator_class').notNull(),
});

// Pipeline runs
const pipelineRuns = pgTable('pipeline_runs', {
  id: serial('id').primaryKey(),
  startTime: timestamp('start_time').defaultNow().notNull(),
  endTime: timestamp('end_time'),
  status: text('status').notNull().default('running'), // running, completed, failed
  metadata: json('metadata'),
});

// Stage executions
const stageExecutions = pgTable('stage_executions', {
  id: serial('id').primaryKey(),
  pipelineRunId: integer('pipeline_run_id').notNull().references(() => pipelineRuns.id),
  stageId: integer('stage_id').notNull().references(() => pipelineStages.id),
  artifactId: integer('artifact_id').references(() => artifacts.id),
  startTime: timestamp('start_time').defaultNow().notNull(),
  endTime: timestamp('end_time'),
  status: text('status').notNull().default('running'), // running, waiting_approval, approved, rejected, completed, failed
  logs: text('logs'),
});

// Define relations for stage executions
const stageExecutionsRelations = relations(stageExecutions, ({ one }) => ({
  pipelineRun: one(pipelineRuns, {
    fields: [stageExecutions.pipelineRunId],
    references: [pipelineRuns.id],
  }),
  stage: one(pipelineStages, {
    fields: [stageExecutions.stageId],
    references: [pipelineStages.id],
  }),
  artifact: one(artifacts, {
    fields: [stageExecutions.artifactId],
    references: [artifacts.id],
  }),
}));

// Stakeholders
const stakeholders = pgTable('stakeholders', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  role: text('role').notNull(), // product_manager, engineer, designer, etc.
});

// Sign-offs
const signOffs = pgTable('sign_offs', {
  id: serial('id').primaryKey(),
  stageExecutionId: integer('stage_execution_id').notNull().references(() => stageExecutions.id),
  stakeholderId: integer('stakeholder_id').notNull().references(() => stakeholders.id),
  status: text('status').notNull().default('pending'), // pending, approved, rejected
  comments: text('comments'),
  timestamp: timestamp('timestamp'),
});

// Define relations for sign-offs
const signOffsRelations = relations(signOffs, ({ one }) => ({
  stageExecution: one(stageExecutions, {
    fields: [signOffs.stageExecutionId],
    references: [stageExecutions.id],
  }),
  stakeholder: one(stakeholders, {
    fields: [signOffs.stakeholderId],
    references: [stakeholders.id],
  }),
}));

// Export all schema objects
module.exports = {
  artifacts,
  artifactsRelations,
  pipelineStages,
  pipelineRuns,
  stageExecutions,
  stageExecutionsRelations,
  stakeholders,
  signOffs,
  signOffsRelations,
};
