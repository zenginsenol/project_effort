import { expect, test } from '@playwright/test';

test.describe('Cost Analysis', () => {
  test('effort workflow page loads with all steps visible', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByRole('heading', { name: 'Effort & Cost Workflow' })).toBeVisible();
    await expect(page.getByText('Step 1: Project & Calculation Parameters')).toBeVisible();
    await expect(page.getByText('Step 1')).toBeVisible();
    await expect(page.getByText('Step 2')).toBeVisible();
    await expect(page.getByText('Step 3')).toBeVisible();
    await expect(page.getByText('Step 4')).toBeVisible();
  });

  test('project selection dropdown is visible', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByRole('combobox', { name: /project/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeVisible();
  });

  test('calculation parameters are configurable', async ({ page }) => {
    await page.goto('/dashboard/effort');

    // Check all parameter inputs are visible
    await expect(page.getByLabel('Hourly Rate')).toBeVisible();
    await expect(page.getByRole('combobox').filter({ hasText: /TL|USD|EUR/ })).toBeVisible();
    await expect(page.getByLabel('Contingency %')).toBeVisible();
    await expect(page.getByLabel('Work Hours/Day')).toBeVisible();
  });

  test('empty state shows when no project selected', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByRole('heading', { name: 'Select a Project' })).toBeVisible();
    await expect(page.getByText('Choose a project above to calculate effort and cost.')).toBeVisible();
  });

  test('baseline cost summary section is present', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByText('Step 3: Baseline Cost Summary')).toBeVisible();
  });

  test('operational cost inputs are visible', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByText('Operational Cost Inputs (Year-1 Projection)')).toBeVisible();
    await expect(page.getByLabel('Infra/Ops Monthly')).toBeVisible();
    await expect(page.getByLabel('Domain/SSL Annual')).toBeVisible();
    await expect(page.getByLabel('Maintenance Hours / Month')).toBeVisible();
  });

  test('roadmap configuration options are available', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByText('Include completed tasks in roadmap')).toBeVisible();
    await expect(page.getByText('Auto-apply roadmap to Kanban')).toBeVisible();
    await expect(page.getByText('Move week-1 tasks to Todo')).toBeVisible();
    await expect(page.getByRole('button', { name: /Apply Roadmap to Kanban/ })).toBeVisible();
  });
});

test.describe('Cost Analysis - Workspace', () => {
  test('cost analysis workspace section is visible', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByRole('heading', { name: /Step 4: Cost Analysis Workspace/ })).toBeVisible();
    await expect(page.getByText('Save, edit, and reuse cost analysis snapshots for this project.')).toBeVisible();
  });

  test('save snapshot button is present', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByRole('button', { name: /Save Current Snapshot/ })).toBeVisible();
  });

  test('update and delete buttons are present', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByRole('button', { name: /Update Selected/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Delete/ })).toBeVisible();
  });

  test('analysis metadata fields are editable', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByLabel('Analysis Name')).toBeVisible();
    await expect(page.getByLabel('Description')).toBeVisible();
    await expect(page.getByLabel(/Assumptions/)).toBeVisible();
  });

  test('analysis name accepts input', async ({ page }) => {
    await page.goto('/dashboard/effort');
    const nameInput = page.getByLabel('Analysis Name');
    await nameInput.fill('Q1 2026 Baseline');
    await expect(nameInput).toHaveValue('Q1 2026 Baseline');
  });

  test('assumptions textarea accepts multiline input', async ({ page }) => {
    await page.goto('/dashboard/effort');
    const assumptionsInput = page.getByLabel(/Assumptions/);
    await assumptionsInput.fill('Single squad, 8h/day\nNo major architecture rewrite');
    await expect(assumptionsInput).toHaveValue('Single squad, 8h/day\nNo major architecture rewrite');
  });
});

test.describe('Cost Analysis - AI Analysis', () => {
  test('AI analysis section is visible', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByRole('heading', { name: /Step 5: AI Cost Analysis/ })).toBeVisible();
    await expect(page.getByText('Generate a new analysis from document text using active provider/model settings.')).toBeVisible();
  });

  test('AI provider configuration is present', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByText('Use model/effort from Settings')).toBeVisible();
    await expect(page.getByLabel('Provider')).toBeVisible();
    await expect(page.getByRole('button', { name: /Create AI Analysis/ })).toBeVisible();
  });

  test('AI input fields are visible', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByLabel('AI Project Context (optional)')).toBeVisible();
    await expect(page.getByLabel('Requirements / Scope Text')).toBeVisible();
  });

  test('create AI analysis button is disabled when no text', async ({ page }) => {
    await page.goto('/dashboard/effort');
    const createButton = page.getByRole('button', { name: /Create AI Analysis/ });
    await expect(createButton).toBeDisabled();
  });
});

test.describe('Cost Analysis - Additional Costs', () => {
  test('editable operational cost sections are visible', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByRole('heading', { name: 'Editable Operational Cost Sections' })).toBeVisible();
    await expect(page.getByText('Maintain alternative infra/domain/maintenance cost items in saved analyses.')).toBeVisible();
  });

  test('add cost item button is present', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByRole('button', { name: 'Add Cost Item' })).toBeVisible();
  });

  test('can add additional cost item', async ({ page }) => {
    await page.goto('/dashboard/effort');
    const addButton = page.getByRole('button', { name: 'Add Cost Item' });
    await addButton.click();

    // Check that cost item fields appear
    await expect(page.getByPlaceholder('Additional cost label')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();
  });

  test('additional cost item has all required fields', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await page.getByRole('button', { name: 'Add Cost Item' }).click();

    // Verify all fields are present
    await expect(page.getByPlaceholder('Additional cost label')).toBeVisible();
    await expect(page.getByPlaceholder('Notes')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();
  });

  test('can input additional cost details', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await page.getByRole('button', { name: 'Add Cost Item' }).click();

    const labelInput = page.getByPlaceholder('Additional cost label');
    await labelInput.fill('Cloud hosting premium');
    await expect(labelInput).toHaveValue('Cloud hosting premium');
  });
});

test.describe('Cost Analysis - Saved Analyses', () => {
  test('saved analyses section is visible', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByRole('heading', { name: /Step 6: Saved Analyses/ })).toBeVisible();
    await expect(page.getByText('Select one record to edit/export. Select multiple records to compare.')).toBeVisible();
  });

  test('compare analyses section is visible', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByRole('heading', { name: /Step 7: Compare Analyses/ })).toBeVisible();
    await expect(page.getByText('Choose at least 2 analyses to compute deltas against baseline.')).toBeVisible();
  });

  test('compare link to dedicated page is present', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByRole('link', { name: /Need provider-level compare\? Open Compare AI page/ })).toBeVisible();
  });
});

test.describe('Cost Analysis - Export & GitHub', () => {
  test('export and github section is visible', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByRole('heading', { name: /Step 8: Export & GitHub Integration/ })).toBeVisible();
    await expect(page.getByText('Export selected analysis or sync it as GitHub issue in linked repository.')).toBeVisible();
  });

  test('all export format buttons are present', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByRole('button', { name: /Export JSON/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Export CSV/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Export Markdown/ })).toBeVisible();
  });

  test('github sync button is present', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByRole('button', { name: /Sync to GitHub/ })).toBeVisible();
  });

  test('repository override input is visible', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByLabel('Repository Override (optional)')).toBeVisible();
    await expect(page.getByPlaceholder('owner/repo or GitHub URL')).toBeVisible();
  });

  test('export buttons are disabled when no analysis selected', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByRole('button', { name: /Export JSON/ })).toBeDisabled();
    await expect(page.getByRole('button', { name: /Export CSV/ })).toBeDisabled();
    await expect(page.getByRole('button', { name: /Export Markdown/ })).toBeDisabled();
    await expect(page.getByRole('button', { name: /Sync to GitHub/ })).toBeDisabled();
  });

  test('repository override accepts input', async ({ page }) => {
    await page.goto('/dashboard/effort');
    const repoInput = page.getByLabel('Repository Override (optional)');
    await repoInput.fill('myorg/myrepo');
    await expect(repoInput).toHaveValue('myorg/myrepo');
  });
});

test.describe('Cost Analysis - Navigation', () => {
  test('back to projects link is visible', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByRole('link', { name: /Back to projects/ })).toBeVisible();
  });

  test('open compare link is visible', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByRole('link', { name: /Open compare/ })).toBeVisible();
  });

  test('back to projects link navigates correctly', async ({ page }) => {
    await page.goto('/dashboard/effort');
    const backLink = page.getByRole('link', { name: /Back to projects/ });
    await expect(backLink).toHaveAttribute('href', '/dashboard/projects');
  });

  test('open compare link has correct base href', async ({ page }) => {
    await page.goto('/dashboard/effort');
    const compareLink = page.getByRole('link', { name: /Open compare/ });
    const href = await compareLink.getAttribute('href');
    expect(href).toContain('/dashboard/compare');
  });
});

test.describe('Cost Analysis - Breakdown Views', () => {
  test('breakdown by type section exists', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByRole('heading', { name: 'Breakdown by Task Type' })).toBeVisible();
  });

  test('breakdown by priority section exists', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByRole('heading', { name: 'Breakdown by Priority' })).toBeVisible();
  });

  test('breakdown by status section exists', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByRole('heading', { name: 'Breakdown by Status' })).toBeVisible();
  });

  test('all tasks detail section exists', async ({ page }) => {
    await page.goto('/dashboard/effort');
    await expect(page.getByRole('heading', { name: /All Tasks Detail/ })).toBeVisible();
  });
});
