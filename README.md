# SWE Artifact Delivery Pipeline

This project implements an Apache Airflow 2.x workflow pipeline for SWE artifact delivery with Supabase/Drizzle integration for persistence.

## Overview

The pipeline orchestrates the following steps:
1. Process PRD documents to extract domain entities
2. Convert business logic to API actions
3. Generate TypeSpec files
4. Create Zod and database schemas
5. Track stakeholder approvals for each stage

## Tech Stack

- Apache Airflow 2.x (workflow orchestration)
- Node.js (operator implementation)
- TypeSpec (API specification)
- Zod (schema validation)
- Drizzle ORM (database ORM)
- Supabase (persistence layer)
- OpenAPI

## Setup

### Prerequisites

- Node.js 16+
- Apache Airflow 2.x
- Supabase account and project

### Environment Variables

Create a `.env` file with the following variables:

