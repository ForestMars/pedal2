import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Get database connection string from environment variables
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/swe_pipeline';

// Create a postgres client
const client = postgres(connectionString);

// Create a drizzle client
export const db = drizzle(client, { schema });
