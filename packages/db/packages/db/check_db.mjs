import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL ?? 'postgresql://estimatepro:estimatepro_dev@localhost:5433/estimatepro', { max: 1 });

try {
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('subscriptions', 'invoices', 'usage_tracking')
    ORDER BY table_name;
  `;

  console.log('Billing tables in database:');
  tables.forEach(t => console.log(`  - ${t.table_name}`));

  if (tables.length === 3) {
    console.log('\n✓ All billing tables exist!');
  } else {
    console.log(`\n⚠️  Only ${tables.length}/3 billing tables exist`);
  }
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await sql.end();
}
