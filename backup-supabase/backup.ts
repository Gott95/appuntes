import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://ielnxqgbvglrdiolwqlt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllbG54cWdidmdscmRpb2x3cWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MjY0NDYsImV4cCI6MjA5ODEwMjQ0Nn0.uKCuWXRzVD-yToiDAPRfqHQJJWRKm_KjvxjOycOhzxY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TABLES = [
  'profiles',
  'categories',
  'salary_entries',
  'fixed_expenses',
  'transactions',
  'savings_goals',
  'savings_entries',
  'households',
  'household_members',
  'household_messages',
  'household_activity',
  'installment_plans',
  'installment_payments',
  'vault_entries',
  'app_config'
];

async function backupTable(tableName: string) {
  console.log(`Backing up ${tableName}...`);
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(10000);

  if (error) {
    console.error(`Error backing up ${tableName}:`, error.message);
    return [];
  }

  return data || [];
}

async function main() {
  const backupDir = __dirname;
  const results: Record<string, any> = {};

  for (const table of TABLES) {
    const data = await backupTable(table);
    results[table] = data;

    const filePath = path.join(backupDir, `${table}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`  Saved ${data.length} records to ${table}.json`);
  }

  const summaryPath = path.join(backupDir, 'backup-summary.json');
  const summary = Object.entries(results).map(([table, data]) => ({
    table,
    count: Array.isArray(data) ? data.length : 0
  }));
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log('\nBackup complete! Summary saved to backup-summary.json');
}

main().catch(console.error);
