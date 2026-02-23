import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql as rawSql } from 'drizzle-orm';
import { db } from './index';

async function applyMigration(): Promise<void> {
  console.log('Applying billing subscription migration...');

  try {
    // Read the migration SQL file
    const migrationPath = join(__dirname, '..', 'drizzle', '0000_billing_subscription_management.sql');
    const migration = readFileSync(migrationPath, 'utf-8');

    // Split by statement breakpoint
    const statements = migration
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      try {
        await db.execute(rawSql.raw(statements[i]));
        console.log(`✓ Statement ${i + 1}/${statements.length} executed`);
      } catch (error: any) {
        // Ignore "already exists" errors
        if (error.message && error.message.includes('already exists')) {
          console.log(`⊘ Statement ${i + 1}/${statements.length} skipped (already exists)`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n✓ Migration applied successfully!');
    process.exit(0);
  } catch (error: unknown) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

applyMigration();
