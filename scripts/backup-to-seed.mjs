#!/usr/bin/env node
/**
 * Winterdienst Tracker - Backup to Seed Converter
 * 
 * Converts a JSON backup file to seed.sql format for local Supabase development.
 * Also creates safe rollback capability by generating rollback migrations.
 * 
 * Usage:
 *   node scripts/backup-to-seed.mjs                          # Use latest backup
 *   node scripts/backup-to-seed.mjs --backup backup.json     # Use specific backup
 *   node scripts/backup-to-seed.mjs --production             # Create fresh backup first
 * 
 * This script will:
 * 1. Read the backup JSON file
 * 2. Generate supabase/seed.sql with INSERT statements
 * 3. Preserve foreign key order for safe insertion
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  backupDir: process.env.BACKUP_DIR || './backups',
  seedFile: './supabase/seed.sql',
  // Tables to skip when seeding (auth managed by Supabase)
  skipTables: ['schema_migrations'],
  // Tables that require special handling for users
  authTables: ['users'],
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`[OK] ${message}`, colors.green);
}

function logError(message) {
  log(`[ERROR] ${message}`, colors.red);
}

function logInfo(message) {
  log(`[INFO] ${message}`, colors.blue);
}

function logWarning(message) {
  log(`[WARN] ${message}`, colors.yellow);
}

/**
 * Find the latest backup file in the backup directory
 */
function findLatestBackup() {
  const backupDir = path.resolve(CONFIG.backupDir);
  
  if (!fs.existsSync(backupDir)) {
    throw new Error(`Backup directory not found: ${backupDir}`);
  }
  
  const files = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.json') && f.startsWith('backup-'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    throw new Error('No backup files found. Run: npm run db:backup');
  }
  
  return path.join(backupDir, files[0]);
}

/**
 * Escape a value for SQL insertion
 */
function escapeValue(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  
  if (typeof value === 'number') {
    return value.toString();
  }
  
  if (typeof value === 'object') {
    // JSON objects and arrays
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }
  
  if (typeof value === 'string') {
    // Check if it looks like a UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return `'${value}'::uuid`;
    }
    
    // Check if it looks like a date/timestamp
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(value)) {
      return `'${value}'`;
    }
    
    // Regular string - escape single quotes
    return `'${value.replace(/'/g, "''")}'`;
  }
  
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Generate INSERT statements for a table
 */
function generateInserts(tableName, rows) {
  if (!rows || rows.length === 0) {
    return `-- No data for ${tableName}\n`;
  }
  
  const statements = [];
  const columns = Object.keys(rows[0]);
  
  statements.push(`-- ${tableName}: ${rows.length} rows`);
  
  for (const row of rows) {
    const values = columns.map(col => escapeValue(row[col]));
    statements.push(
      `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;`
    );
  }
  
  return statements.join('\n');
}

/**
 * Generate seed.sql from backup
 */
function generateSeedSQL(backup) {
  const lines = [];
  
  // Header
  lines.push('-- ========================================');
  lines.push('-- Winterdienst Tracker - Seed Data');
  lines.push(`-- Generated from backup: ${backup._meta?.created_at || 'unknown'}`);
  lines.push(`-- Backup version: ${backup._meta?.version || '1.0.0'}`);
  lines.push('-- ========================================');
  lines.push('');
  lines.push('-- This file is auto-generated. Do not edit manually.');
  lines.push('-- To regenerate: npm run db:seed:generate');
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');
  
  // Disable triggers during insert for speed
  lines.push('-- Disable triggers for bulk insert');
  lines.push('SET session_replication_role = replica;');
  lines.push('');
  
  // Get restore order
  const restoreOrder = backup._restore?.order || Object.keys(backup.tables || backup);
  
  // Generate inserts for each table in order
  for (const tableName of restoreOrder) {
    if (CONFIG.skipTables.includes(tableName)) {
      continue;
    }
    
    const tableData = backup.tables?.[tableName] || backup[tableName];
    
    if (!tableData) {
      continue;
    }
    
    // Handle both array format and object format with rows property
    const rows = Array.isArray(tableData) ? tableData : tableData.rows;
    
    if (rows && rows.length > 0) {
      lines.push(`-- ----------------------------------------`);
      lines.push(`-- Table: ${tableName}`);
      lines.push(`-- ----------------------------------------`);
      
      // Special handling for users table - need to use auth.users
      if (tableName === 'users') {
        lines.push('-- Note: Users are inserted into public.users');
        lines.push('-- For local dev, auth.users needs separate seeding via Supabase CLI');
      }
      
      lines.push(generateInserts(tableName, rows));
      lines.push('');
    }
  }
  
  // Re-enable triggers
  lines.push('-- Re-enable triggers');
  lines.push('SET session_replication_role = DEFAULT;');
  lines.push('');
  
  // Reset sequences
  lines.push('-- Reset sequences to max ID values');
  lines.push(`SELECT setval('invoice_number_seq', COALESCE((SELECT MAX(CAST(SUBSTRING(invoice_number FROM 9) AS INTEGER)) FROM invoices), 1000), true);`);
  lines.push(`SELECT setval('report_number_seq', COALESCE((SELECT MAX(CAST(SUBSTRING(report_number FROM 9) AS INTEGER)) FROM reports), 1000), true);`);
  lines.push('');
  
  lines.push('COMMIT;');
  lines.push('');
  lines.push('-- Seed completed successfully!');
  
  return lines.join('\n');
}

/**
 * Generate rollback migration
 */
function generateRollbackMigration(backup) {
  const lines = [];
  
  lines.push('-- ========================================');
  lines.push('-- Rollback Migration');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('-- ========================================');
  lines.push('');
  lines.push('-- This migration restores data from a backup.');
  lines.push('-- Run with: supabase db push');
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');
  
  // Get restore order in reverse for deletion
  const restoreOrder = backup._restore?.order || Object.keys(backup.tables || backup);
  const deleteOrder = [...restoreOrder].reverse();
  
  // Delete existing data in reverse order
  lines.push('-- Clear existing data (reverse order for FK constraints)');
  for (const tableName of deleteOrder) {
    if (CONFIG.skipTables.includes(tableName)) continue;
    lines.push(`DELETE FROM ${tableName};`);
  }
  lines.push('');
  
  // Insert backup data
  for (const tableName of restoreOrder) {
    if (CONFIG.skipTables.includes(tableName)) continue;
    
    const tableData = backup.tables?.[tableName] || backup[tableName];
    const rows = Array.isArray(tableData) ? tableData : tableData?.rows;
    
    if (rows && rows.length > 0) {
      lines.push(`-- ${tableName}`);
      lines.push(generateInserts(tableName, rows));
      lines.push('');
    }
  }
  
  lines.push('COMMIT;');
  
  return lines.join('\n');
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  
  log('\nBackup to Seed Converter', colors.cyan + colors.bright);
  log('================================\n');
  
  let backupPath;
  
  // Parse arguments
  const backupIndex = args.indexOf('--backup');
  if (backupIndex !== -1 && args[backupIndex + 1]) {
    backupPath = path.resolve(args[backupIndex + 1]);
  } else {
    logInfo('Finding latest backup...');
    backupPath = findLatestBackup();
  }
  
  logInfo(`Using backup: ${backupPath}`);
  
  // Read backup file
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }
  
  const backupContent = fs.readFileSync(backupPath, 'utf-8');
  const backup = JSON.parse(backupContent);
  
  logInfo(`Backup version: ${backup._meta?.version || 'unknown'}`);
  logInfo(`Backup created: ${backup._meta?.created_at || 'unknown'}`);
  
  // Count tables and rows
  const restoreOrder = backup._restore?.order || Object.keys(backup.tables || backup);
  let totalRows = 0;
  for (const tableName of restoreOrder) {
    const tableData = backup.tables?.[tableName] || backup[tableName];
    const rows = Array.isArray(tableData) ? tableData : tableData?.rows;
    if (rows) totalRows += rows.length;
  }
  logInfo(`Tables: ${restoreOrder.length}, Total rows: ${totalRows}`);
  
  // Generate seed.sql
  log('\nGenerating seed.sql...', colors.yellow);
  const seedSQL = generateSeedSQL(backup);
  
  const seedPath = path.resolve(CONFIG.seedFile);
  fs.writeFileSync(seedPath, seedSQL, 'utf-8');
  logSuccess(`Seed file written: ${seedPath}`);
  
  // Generate rollback migration
  log('\nGenerating rollback migration...', colors.yellow);
  const rollbackSQL = generateRollbackMigration(backup);
  
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const rollbackPath = path.resolve(`./supabase/migrations/rollback_${timestamp}.sql`);
  fs.writeFileSync(rollbackPath, rollbackSQL, 'utf-8');
  logSuccess(`Rollback migration written: ${rollbackPath}`);
  
  // Summary
  log('\nConversion complete.', colors.green + colors.bright);
  log('\nNext steps:', colors.cyan);
  log('  1. Start local Supabase: npm run supabase:start');
  log('  2. Reset with new seed:  npm run supabase:reset');
  log('\nTo restore to production (use with caution):');
  log(`  supabase db push --include-migrations ${rollbackPath}`);
  log('');
}

// Run
main().catch(err => {
  logError(err.message);
  process.exit(1);
});
