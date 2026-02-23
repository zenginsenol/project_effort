import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { readFileSync } from 'fs';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://estimatepro:estimatepro_dev@localhost:5433/estimatepro';
const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

try {
  // Read the migration file
  const migration = readFileSync('drizzle/0000_billing_subscription_management.sql', 'utf-8');

  // Split by statement breakpoint and filter out empty statements
  const statements = migration
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`Found ${statements.length} SQL statements to execute`);

  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    try {
      await sql.unsafe(statements[i]);
      console.log(`✓ Statement ${i + 1}/${statements.length} executed`);
    } catch (error) {
      // Ignore "already exists" errors
      if (error.message.includes('already exists')) {
        console.log(`⊘ Statement ${i + 1}/${statements.length} skipped (already exists)`);
      } else {
        throw error;
      }
    }
  }

  console.log('\n✓ Migration applied successfully!');
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
} finally {
  await sql.end();
}
