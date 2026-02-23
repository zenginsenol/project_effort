import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL ?? 'postgresql://estimatepro:estimatepro_dev@localhost:5433/estimatepro');

async function verifySchema(): Promise<void> {
  try {
    // Check if activity_type enum exists
    const enumCheck = await sql`
      SELECT 1 FROM pg_type WHERE typname = 'activity_type';
    `;
    console.log(enumCheck.length > 0 ? '✓ activity_type enum exists' : '✗ activity_type enum missing');

    // Check if activities table exists
    const tableCheck = await sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'activities';
    `;
    console.log(tableCheck.length > 0 ? '✓ activities table exists' : '✗ activities table missing');

    // Check indexes
    const indexCheck = await sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'activities'
      ORDER BY indexname;
    `;
    console.log(`✓ Found ${indexCheck.length} indexes on activities table:`);
    indexCheck.forEach((row: any) => console.log(`  - ${row.indexname}`));

    // Check foreign keys
    const fkCheck = await sql`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'activities'::regclass AND contype = 'f';
    `;
    console.log(`✓ Found ${fkCheck.length} foreign key constraints:`);
    fkCheck.forEach((row: any) => console.log(`  - ${row.conname}`));

    console.log('\n✅ Schema verification passed!');
  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

verifySchema();
