import postgres from 'postgres';

const sql = postgres({
  host: 'localhost',
  port: 5433,
  user: 'postgres',
  password: 'postgres',
  database: 'project_effort'
});

sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('subscriptions', 'invoices', 'usage_tracking') ORDER BY table_name`
  .then(result => {
    console.log('=== Billing Tables Check ===');
    console.log('Found', result.length, 'out of 3 expected tables');
    console.log('');
    const found = result.map(r => r.table_name);
    ['subscriptions', 'invoices', 'usage_tracking'].forEach(t => {
      const exists = found.includes(t);
      console.log((exists ? 'OK' : 'XX'), t + ':', exists ? 'EXISTS' : 'NOT FOUND');
    });
    return sql.end();
  })
  .catch(e => {
    console.error('Error:', e.message);
    sql.end();
    process.exit(1);
  });
