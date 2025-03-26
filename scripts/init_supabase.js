/**
 * Initialize the Supabase database schema for the SWE artifact pipeline
 * This script uses Drizzle to push the schema to Supabase
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure DATABASE_URL environment variable is set
if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is not set');
  console.error('Please set it to your Supabase connection string');
  process.exit(1);
}

console.log('Initializing Supabase database schema...');

try {
  // Run drizzle-kit push to update the database schema
  execSync('npx drizzle-kit push:pg', { stdio: 'inherit' });
  console.log('Database schema pushed successfully');

  // Seed initial pipeline stages
  const { db } = require('../shared/db');
  const { pipelineStages } = require('../shared/schema');

  async function seedInitialStages() {
    console.log('Seeding initial pipeline stages...');
    
    // Check if stages already exist
    const existingStages = await db.select().from(pipelineStages);
    if (existingStages.length > 0) {
      console.log('Pipeline stages already exist, skipping seed');
      return;
    }

    // Define initial pipeline stages
    const initialStages = [
      {
        name: 'PRD Processing',
        description: 'Process the Product Requirements Document to extract domain entities',
        orderIndex: 0,
        requiredApprovals: 1,
        artifactType: 'PRD',
        inputType: null,
      },
      {
        name: 'DDD Model Creation',
        description: 'Create domain-driven design model from PRD',
        orderIndex: 1,
        requiredApprovals: 1,
        artifactType: 'DDD_MODEL',
        inputType: 'PRD',
      },
      {
        name: 'API Specification',
        description: 'Generate API specifications from DDD model',
        orderIndex: 2,
        requiredApprovals: 2,
        artifactType: 'API_SPEC',
        inputType: 'DDD_MODEL',
      },
      {
        name: 'TypeSpec Generation',
        description: 'Generate TypeSpec files from API specification',
        orderIndex: 3,
        requiredApprovals: 1,
        artifactType: 'TYPESPEC',
        inputType: 'API_SPEC',
      },
      {
        name: 'Schema Generation',
        description: 'Generate Zod and database schemas from TypeSpec',
        orderIndex: 4,
        requiredApprovals: 2,
        artifactType: 'ZOD_SCHEMA',
        inputType: 'TYPESPEC',
      },
      {
        name: 'Database Schema Generation',
        description: 'Generate final database schema',
        orderIndex: 5,
        requiredApprovals: 2,
        artifactType: 'DB_SCHEMA',
        inputType: 'ZOD_SCHEMA',
      },
    ];

    // Insert the initial stages
    await db.insert(pipelineStages).values(initialStages);
    console.log('Initial pipeline stages seeded successfully');
  }

  // Run seed function
  seedInitialStages()
    .then(() => {
      console.log('Initialization complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error during initialization:', error);
      process.exit(1);
    });

} catch (error) {
  console.error('Error initializing database:', error);
  process.exit(1);
}
