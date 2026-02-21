import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || 'postgresql://estimatepro:estimatepro_dev@localhost:5433/estimatepro';
const sql = postgres(connectionString);

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value.trim();
}

function parseBindings(raw) {
  if (!raw || !raw.trim()) {
    throw new Error('Missing required env: GITHUB_BINDINGS_JSON');
  }
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('GITHUB_BINDINGS_JSON must be a non-empty array');
  }

  return parsed.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Binding[${index}] must be an object`);
    }
    const projectId = typeof item.projectId === 'string' ? item.projectId.trim() : '';
    const repository = typeof item.repository === 'string' ? item.repository.trim() : '';
    const token = typeof item.token === 'string' ? item.token.trim() : '';
    const autoSync = item.autoSync !== false;
    if (!projectId || !repository || !token) {
      throw new Error(`Binding[${index}] requires projectId, repository, token`);
    }
    return { projectId, repository, token, autoSync };
  });
}

async function fetchGithubProfile(token) {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'EstimatePro-BindScript',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub profile fetch failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  const login = typeof payload.login === 'string' ? payload.login.trim() : '';
  if (!login) {
    throw new Error('GitHub profile does not include login');
  }

  return {
    login,
    id: typeof payload.id === 'number' ? payload.id : null,
    htmlUrl: typeof payload.html_url === 'string' ? payload.html_url : null,
    name: typeof payload.name === 'string' ? payload.name : null,
  };
}

function toSettings(raw) {
  const base = {
    profile: null,
    projectLinks: {},
  };

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return base;
  }

  const settings = raw;
  const profile = settings.profile && typeof settings.profile === 'object' && !Array.isArray(settings.profile)
    ? settings.profile
    : null;
  const links = settings.projectLinks && typeof settings.projectLinks === 'object' && !Array.isArray(settings.projectLinks)
    ? settings.projectLinks
    : {};

  return {
    profile,
    projectLinks: { ...links },
  };
}

async function upsertGithubIntegration(orgId, token, profile) {
  const rows = await sql`
    select id, settings
    from integrations
    where organization_id = ${orgId}
      and type = 'github'
    order by updated_at desc
  `;

  const matched = rows.find((row) => {
    const settings = toSettings(row.settings);
    const login = settings.profile && typeof settings.profile.login === 'string'
      ? settings.profile.login.toLowerCase()
      : '';
    return login === profile.login.toLowerCase();
  });

  if (matched) {
    const settings = toSettings(matched.settings);
    const nextSettings = {
      profile,
      projectLinks: settings.projectLinks,
    };

    await sql`
      update integrations
      set is_active = true,
          access_token = ${token},
          refresh_token = null,
          token_expires_at = null,
          settings = ${sql.json(nextSettings)},
          updated_at = now()
      where id = ${matched.id}
    `;

    return matched.id;
  }

  const inserted = await sql`
    insert into integrations (
      organization_id,
      type,
      is_active,
      access_token,
      refresh_token,
      token_expires_at,
      external_project_id,
      settings
    )
    values (
      ${orgId},
      'github',
      true,
      ${token},
      null,
      null,
      null,
      ${sql.json({ profile, projectLinks: {} })}
    )
    returning id
  `;

  return inserted[0].id;
}

async function loadActiveGithubIntegrations(orgId) {
  return sql`
    select id, settings
    from integrations
    where organization_id = ${orgId}
      and type = 'github'
      and is_active = true
    order by updated_at desc
  `;
}

async function bindProjectToIntegration({ orgId, projectId, repository, autoSync, integrationId }) {
  const activeRows = await loadActiveGithubIntegrations(orgId);
  const nowIso = new Date().toISOString();

  for (const row of activeRows) {
    const settings = toSettings(row.settings);
    if (!settings.projectLinks[projectId]) {
      continue;
    }
    if (row.id === integrationId) {
      continue;
    }

    const nextLinks = { ...settings.projectLinks };
    delete nextLinks[projectId];
    await sql`
      update integrations
      set settings = ${sql.json({
    profile: settings.profile,
    projectLinks: nextLinks,
  })},
          updated_at = now()
      where id = ${row.id}
    `;
  }

  const selectedRows = await sql`
    select id, settings
    from integrations
    where id = ${integrationId}
      and organization_id = ${orgId}
      and type = 'github'
      and is_active = true
    limit 1
  `;
  const selected = selectedRows[0];
  if (!selected) {
    throw new Error(`Active github integration not found: ${integrationId}`);
  }

  const selectedSettings = toSettings(selected.settings);
  const nextLinks = {
    ...selectedSettings.projectLinks,
    [projectId]: {
      externalProjectId: repository,
      autoSync,
      updatedAt: nowIso,
      integrationId,
    },
  };

  await sql`
    update integrations
    set external_project_id = ${repository},
        settings = ${sql.json({
    profile: selectedSettings.profile,
    projectLinks: nextLinks,
  })},
        updated_at = now()
    where id = ${integrationId}
  `;
}

async function assertProjectOwnership(orgId, projectId) {
  const rows = await sql`
    select id, name
    from projects
    where id = ${projectId}
      and organization_id = ${orgId}
    limit 1
  `;
  if (!rows[0]) {
    throw new Error(`Project not found in org: ${projectId}`);
  }
  return rows[0];
}

async function main() {
  const orgId = required('TARGET_ORG_ID');
  const bindings = parseBindings(required('GITHUB_BINDINGS_JSON'));

  const results = [];
  try {
    for (const binding of bindings) {
      const project = await assertProjectOwnership(orgId, binding.projectId);
      const profile = await fetchGithubProfile(binding.token);
      const integrationId = await upsertGithubIntegration(orgId, binding.token, profile);
      await bindProjectToIntegration({
        orgId,
        projectId: binding.projectId,
        repository: binding.repository,
        autoSync: binding.autoSync,
        integrationId,
      });

      results.push({
        projectId: binding.projectId,
        projectName: project.name,
        repository: binding.repository,
        githubLogin: profile.login,
        integrationId,
      });
    }
  } finally {
    await sql.end({ timeout: 1 });
  }

  console.log('BINDINGS_APPLIED');
  for (const row of results) {
    console.log([
      row.projectId,
      row.projectName,
      row.repository,
      row.githubLogin,
      row.integrationId,
    ].join('\t'));
  }
}

main().catch((error) => {
  console.error(`[bind-project-github-repos] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
