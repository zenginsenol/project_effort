import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL ?? 'postgresql://estimatepro:estimatepro_dev@localhost:5433/estimatepro');

async function applyMigration(): Promise<void> {
  try {
    // First, create the enum if it doesn't exist
    try {
      await sql`
        CREATE TYPE activity_type AS ENUM(
          'task_created', 'task_updated', 'task_status_changed',
          'session_created', 'session_completed',
          'cost_analysis_created', 'cost_analysis_exported',
          'integration_sync_completed',
          'member_joined', 'member_left',
          'project_created', 'project_updated', 'project_deleted'
        );
      `;
      console.log('✓ Created activity_type enum');
    } catch (e: any) {
      if (e.code === '42710') {
        console.log('✓ activity_type enum already exists');
      } else {
        throw e;
      }
    }

    // Create the activities table
    await sql`
      CREATE TABLE activities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        organization_id uuid NOT NULL,
        project_id uuid,
        actor_id uuid,
        activity_type activity_type NOT NULL,
        entity_type text NOT NULL,
        entity_id uuid NOT NULL,
        metadata jsonb,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    console.log('✓ Created activities table');

    // Add foreign keys
    await sql`ALTER TABLE activities ADD CONSTRAINT activities_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE cascade;`;
    await sql`ALTER TABLE activities ADD CONSTRAINT activities_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE cascade;`;
    await sql`ALTER TABLE activities ADD CONSTRAINT activities_actor_id_users_id_fk FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE set null;`;
    console.log('✓ Added foreign key constraints');

    // Create indexes
    await sql`CREATE INDEX idx_activities_organization_id ON activities USING btree (organization_id);`;
    await sql`CREATE INDEX idx_activities_project_id ON activities USING btree (project_id);`;
    await sql`CREATE INDEX idx_activities_actor_id ON activities USING btree (actor_id);`;
    await sql`CREATE INDEX idx_activities_activity_type ON activities USING btree (activity_type);`;
    await sql`CREATE INDEX idx_activities_created_at ON activities USING btree (created_at);`;
    console.log('✓ Created indexes');

    console.log('\n✅ Migration applied successfully!');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

applyMigration();
