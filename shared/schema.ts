import { relations } from 'drizzle-orm';
import { pgTable, serial, text, timestamp, boolean, json, integer, uuid } from 'drizzle-orm/pg-core';

// Define artifact types enum values
export const artifactTypes = ['PRD', 'DDD_MODEL', 'API_SPEC', 'TYPESPEC', 'ZOD_SCHEMA', 'DB_SCHEMA'] as const;
export type ArtifactType = typeof artifactTypes[number];

// Artifacts table - stores all artifacts in the delivery pipeline
export const artifacts = pgTable('artifacts', {
  id: serial('id').primaryKey(),
  uuid: uuid('uuid').defaultRandom().notNull().unique(),
  name: text('name').notNull(),
  type: text('type', { enum: artifactTypes }).notNull(),
  content: json('content').notNull(), // JSON content of the artifact
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: text('created_by').notNull(),
  status: text('status', { enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'] }).default('DRAFT').notNull(),
  parentId: integer('parent_id').references(() => artifacts.id),
});

// Relationships for artifacts
export const artifactsRelations = relations(artifacts, ({ one, many }) => ({
  parent: one(artifacts, {
    fields: [artifacts.parentId],
    references: [artifacts.id],
  }),
  children: many(artifacts),
  approvals: many(approvals),
}));

// Stakeholders table - stores information about stakeholders who can approve artifacts
export const stakeholders = pgTable('stakeholders', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  role: text('role').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Approvals table - stores approval records for artifacts
export const approvals = pgTable('approvals', {
  id: serial('id').primaryKey(),
  artifactId: integer('artifact_id').references(() => artifacts.id).notNull(),
  stakeholderId: integer('stakeholder_id').references(() => stakeholders.id).notNull(),
  status: text('status', { enum: ['PENDING', 'APPROVED', 'REJECTED'] }).default('PENDING').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relationship for approvals
export const approvalsRelations = relations(approvals, ({ one }) => ({
  artifact: one(artifacts, {
    fields: [approvals.artifactId],
    references: [artifacts.id],
  }),
  stakeholder: one(stakeholders, {
    fields: [approvals.stakeholderId],
    references: [stakeholders.id],
  }),
}));

// Pipeline stages table - defines the stages in the artifact delivery pipeline
export const pipelineStages = pgTable('pipeline_stages', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  orderIndex: integer('order_index').notNull(),
  requiredApprovals: integer('required_approvals').notNull().default(1),
  artifactType: text('artifact_type', { enum: artifactTypes }).notNull(),
  inputType: text('input_type', { enum: artifactTypes }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Type definitions for TypeScript
export type Artifact = typeof artifacts.$inferSelect;
export type NewArtifact = typeof artifacts.$inferInsert;

export type Stakeholder = typeof stakeholders.$inferSelect;
export type NewStakeholder = typeof stakeholders.$inferInsert;

export type Approval = typeof approvals.$inferSelect;
export type NewApproval = typeof approvals.$inferInsert;

export type PipelineStage = typeof pipelineStages.$inferSelect;
export type NewPipelineStage = typeof pipelineStages.$inferInsert;
