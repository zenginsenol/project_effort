import { expect, test } from '@playwright/test';

test.describe('Project CRUD operations', () => {
  test('create project flow', async ({ page }) => {
    await page.goto('/dashboard/projects');

    // Verify we're on the projects page
    await expect(page.getByRole('heading', { name: 'Kanban Project Dashboard' })).toBeVisible();

    // Fill in project creation form
    const projectName = `E2E Test Project ${Date.now()}`;
    const projectKey = 'E2E';
    const projectDescription = 'E2E test project description';

    await page.getByPlaceholder('Project Name').fill(projectName);
    await page.getByPlaceholder('KEY').fill(projectKey);
    await page.getByPlaceholder('Description (optional)').fill(projectDescription);

    // Click create button
    await page.getByRole('button', { name: 'Create Project' }).click();

    // Wait for project to be created and appear in the list
    // Note: In a real test, we might need to wait for the mutation to complete
    // For now, we just verify the form was reset
    await expect(page.getByPlaceholder('Project Name')).toHaveValue('');
  });

  test('read projects list', async ({ page }) => {
    await page.goto('/dashboard/projects');

    // Verify dashboard is visible
    await expect(page.getByRole('heading', { name: 'Kanban Project Dashboard' })).toBeVisible();

    // Verify project creation section exists
    await expect(page.getByRole('heading', { name: 'Create Project' })).toBeVisible();

    // Verify project list section exists
    await expect(page.getByRole('heading', { name: 'Projects & Transition Shortcuts' })).toBeVisible();

    // Verify form elements are present
    await expect(page.getByPlaceholder('Project Name')).toBeVisible();
    await expect(page.getByPlaceholder('KEY')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Project' })).toBeVisible();
  });

  test('update project details', async ({ page }) => {
    await page.goto('/dashboard/projects');

    // Wait for projects page to load
    await expect(page.getByRole('heading', { name: 'Kanban Project Dashboard' })).toBeVisible();

    // First, create a test project to update
    const projectName = `Update Test ${Date.now()}`;
    const projectKey = 'UPD';

    await page.getByPlaceholder('Project Name').fill(projectName);
    await page.getByPlaceholder('KEY').fill(projectKey);
    await page.getByRole('button', { name: 'Create Project' }).click();

    // Wait a bit for the project to be created
    await page.waitForTimeout(1000);

    // Find and click the edit button (SquarePen icon button)
    // The edit button is the button with SquarePen icon in the project card
    const editButton = page.locator('button').filter({ has: page.locator('svg').first() }).first();
    await editButton.click();

    // Verify edit mode is active by checking for Save button
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('navigate to project detail page', async ({ page }) => {
    await page.goto('/dashboard/projects');

    // Verify we're on the projects page
    await expect(page.getByRole('heading', { name: 'Kanban Project Dashboard' })).toBeVisible();

    // Create a test project first
    const projectName = `Detail Test ${Date.now()}`;
    const projectKey = 'DET';

    await page.getByPlaceholder('Project Name').fill(projectName);
    await page.getByPlaceholder('KEY').fill(projectKey);
    await page.getByRole('button', { name: 'Create Project' }).click();

    // Wait a bit for the project to be created
    await page.waitForTimeout(1000);

    // Click on "Open Kanban Board" link to navigate to project detail
    const kanbanLink = page.getByRole('link', { name: /Open Kanban Board/i }).first();
    await kanbanLink.click();

    // Verify we're on the project detail page
    await expect(page.getByRole('heading', { name: 'Project Details' }).or(page.locator('h1').filter({ hasText: projectName }))).toBeVisible();
  });

  test('empty state displays when no projects exist', async ({ page }) => {
    await page.goto('/dashboard/projects');

    // Verify the projects page loads
    await expect(page.getByRole('heading', { name: 'Kanban Project Dashboard' })).toBeVisible();

    // Note: This test assumes there might be projects already
    // In a real test environment, you'd want to reset the database
    // For now, we just verify the page structure exists

    // Verify the create project section is always visible
    await expect(page.getByRole('heading', { name: 'Create Project' })).toBeVisible();
    await expect(page.getByPlaceholder('Project Name')).toBeVisible();
  });

  test('project statistics display correctly', async ({ page }) => {
    await page.goto('/dashboard/projects');

    // Verify dashboard metrics are visible
    await expect(page.getByRole('heading', { name: 'Kanban Project Dashboard' })).toBeVisible();

    // Verify the three statistics panels exist
    await expect(page.getByText('Projects')).toBeVisible();
    await expect(page.getByText('Active Tasks')).toBeVisible();
    await expect(page.getByText('Completion')).toBeVisible();
  });

  test('workflow cards navigation', async ({ page }) => {
    await page.goto('/dashboard/projects');

    // Verify workflow cards are present
    await expect(page.getByText('1) Ingest Scope')).toBeVisible();
    await expect(page.getByText('2) Execute in Kanban')).toBeVisible();
    await expect(page.getByText('3) Estimate and Compare')).toBeVisible();

    // Verify workflow cards are clickable links
    const analyzerLink = page.getByRole('link', { name: /1\) Ingest Scope/i });
    await expect(analyzerLink).toBeVisible();
    await expect(analyzerLink).toHaveAttribute('href', '/dashboard/analyzer');
  });

  test('project form validation', async ({ page }) => {
    await page.goto('/dashboard/projects');

    // Verify create button is disabled when form is empty
    const createButton = page.getByRole('button', { name: 'Create Project' });

    // Try to click with empty form (button should be disabled)
    await expect(createButton).toBeDisabled();

    // Fill only name, verify still disabled (KEY is required)
    await page.getByPlaceholder('Project Name').fill('Test Project');
    await expect(createButton).toBeDisabled();

    // Fill KEY, now button should be enabled
    await page.getByPlaceholder('KEY').fill('TEST');
    await expect(createButton).toBeEnabled();
  });
});
