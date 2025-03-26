/**
 * Database connection utility for Supabase using Drizzle ORM
 */

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const dotenv = require('dotenv');

dotenv.config();

// Validate environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_KEY environment variables.');
}

// Extract database connection string from Supabase URL
// Format: postgresql://postgres:[password]@[project-ref].supabase.co:5432/postgres
const getConnectionString = () => {
  const url = new URL(SUPABASE_URL);
  return `postgresql://postgres:${SUPABASE_KEY}@${url.hostname}:5432/postgres`;
};

// Create postgres connection
const client = postgres(getConnectionString());

// Create drizzle instance
const db = drizzle(client);

module.exports = {
  db,
  client
};
