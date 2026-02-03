#!/usr/bin/env node
/**
 * Supabase Migration Helper Script
 * 
 * This script handles loading environment variables and running Supabase CLI commands
 * for database migrations.
 * 
 * Usage:
 *   npm run db:migrate              # Push pending migrations to production
 *   npm run db:migrate:status       # Show migration status
 *   npm run db:migrate:new <name>   # Create a new migration file
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Load .env file
function loadEnv() {
  const envPath = path.join(projectRoot, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          process.env[key] = value;
        }
      }
    }
  }
}

// Get database URL from env
function getDatabaseUrl() {
  // Use session pooler on port 6543 for migrations
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) {
    throw new Error('SUPABASE_DB_PASSWORD not set in .env');
  }
  return `postgresql://postgres.doovvabwdfijvbckrqfo:${password}@aws-1-eu-west-1.pooler.supabase.com:6543/postgres`;
}

// Run supabase CLI command
function runSupabase(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['supabase', ...args], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true,
      env: process.env,
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

// Generate timestamp for migration filename
function generateMigrationTimestamp() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

// Main
async function main() {
  loadEnv();
  
  const command = process.argv[2];
  const dbUrl = getDatabaseUrl();

  if (!process.env.SUPABASE_DB_PASSWORD && !process.env.DATABASE_URL) {
    console.error('Error: Missing SUPABASE_DB_PASSWORD or DATABASE_URL in .env');
    process.exit(1);
  }

  console.log('Connecting to Supabase...\n');

  try {
    switch (command) {
      case 'push':
      case 'migrate':
        await runSupabase(['db', 'push', '--db-url', dbUrl]);
        console.log('\nMigrations applied successfully.');
        break;

      case 'status':
        await runSupabase(['migration', 'list', '--db-url', dbUrl]);
        break;

      case 'new': {
        const name = process.argv[3];
        if (!name) {
          console.error('Error: Please provide a migration name: npm run db:migrate:new <name>');
          process.exit(1);
        }
        
        // Count existing migrations to get next number
        const migrationsDir = path.join(projectRoot, 'supabase', 'migrations');
        const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
        const nextNum = files.length.toString().padStart(3, '0');
        
        const filename = `${nextNum}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.sql`;
        const filepath = path.join(migrationsDir, filename);
        
        const template = `-- Migration: ${filename}
-- Description: ${name}
-- Created: ${new Date().toISOString()}

-- Write your migration SQL here

`;
        
        fs.writeFileSync(filepath, template);
        console.log(`Created migration: supabase/migrations/${filename}`);
        break;
      }

      case 'dry-run':
        await runSupabase(['db', 'push', '--db-url', dbUrl, '--dry-run']);
        break;

      default:
        console.log('Supabase Migration Helper');
        console.log('');
        console.log('Commands:');
        console.log('  npm run db:migrate            Push pending migrations');
        console.log('  npm run db:migrate:status     Show migration status');
        console.log('  npm run db:migrate:new <name> Create new migration');
        console.log('  npm run db:migrate:dry        Preview migrations (dry run)');
        break;
    }
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    process.exit(1);
  }
}

main();
