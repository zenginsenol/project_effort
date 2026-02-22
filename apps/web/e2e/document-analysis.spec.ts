import { expect, test } from '@playwright/test';

test.describe('Document Analysis', () => {
  test('analyzer page loads with all tabs', async ({ page }) => {
    await page.goto('/dashboard/analyzer');
    await expect(page.getByRole('heading', { name: 'Task Analyzer' })).toBeVisible();
    await expect(page.getByText('AI Text Analysis')).toBeVisible();
    await expect(page.getByText('File Upload')).toBeVisible();
    await expect(page.getByText('Manual Entry')).toBeVisible();
  });

  test('AI text analysis tab shows input textarea', async ({ page }) => {
    await page.goto('/dashboard/analyzer');
    await expect(page.getByPlaceholder(/Paste your PRD/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Analyze .* Extract Tasks/ })).toBeVisible();
  });

  test('config bar has hourly rate and project context inputs', async ({ page }) => {
    await page.goto('/dashboard/analyzer');
    await expect(page.getByText('Hourly Rate:')).toBeVisible();
    await expect(page.getByPlaceholder(/Project context/)).toBeVisible();
  });

  test('file upload tab shows upload area', async ({ page }) => {
    await page.goto('/dashboard/analyzer');

    // Click the File Upload tab
    await page.getByRole('button', { name: /File Upload/ }).click();

    await expect(page.getByRole('heading', { name: 'Upload Document' })).toBeVisible();
    await expect(page.getByText(/Click to upload a document/)).toBeVisible();
    await expect(page.getByText(/PDF, DOCX, Markdown, or Text file/)).toBeVisible();
  });

  test('manual entry tab shows task table', async ({ page }) => {
    await page.goto('/dashboard/analyzer');

    // Click the Manual Entry tab
    await page.getByRole('button', { name: /Manual Entry/ }).click();

    await expect(page.getByRole('heading', { name: 'Bulk Task Entry' })).toBeVisible();
    await expect(page.getByPlaceholder('Task title...')).toBeVisible();
    await expect(page.getByRole('button', { name: /Add Row/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Review Tasks' })).toBeVisible();
  });

  test('manual entry allows adding tasks', async ({ page }) => {
    await page.goto('/dashboard/analyzer');

    // Switch to Manual Entry tab
    await page.getByRole('button', { name: /Manual Entry/ }).click();

    // Fill in the first task
    const firstTaskInput = page.getByPlaceholder('Task title...').first();
    await firstTaskInput.fill('Create user authentication');

    // Add another row
    await page.getByRole('button', { name: /Add Row/ }).click();

    // Verify two task inputs exist
    const taskInputs = page.getByPlaceholder('Task title...');
    await expect(taskInputs).toHaveCount(2);

    // Fill second task
    await taskInputs.nth(1).fill('Setup database schema');

    // Review Tasks button should be enabled
    const reviewButton = page.getByRole('button', { name: 'Review Tasks' });
    await expect(reviewButton).toBeEnabled();
  });

  test('manual entry shows review screen with stats', async ({ page }) => {
    await page.goto('/dashboard/analyzer');

    // Switch to Manual Entry tab
    await page.getByRole('button', { name: /Manual Entry/ }).click();

    // Fill in a task
    await page.getByPlaceholder('Task title...').first().fill('Test task');

    // Click Review Tasks
    await page.getByRole('button', { name: 'Review Tasks' }).click();

    // Verify review screen elements
    await expect(page.getByRole('heading', { name: 'Review & Edit Tasks' })).toBeVisible();
    await expect(page.getByText('Selected Tasks')).toBeVisible();
    await expect(page.getByText('Total Man-Hours')).toBeVisible();
    await expect(page.getByText('Story Points')).toBeVisible();
    await expect(page.getByText('Estimated Cost')).toBeVisible();

    // Verify Save to Project section
    await expect(page.getByRole('heading', { name: 'Save to Project' })).toBeVisible();
    await expect(page.getByText('Save to existing project')).toBeVisible();
    await expect(page.getByText('Auto-create new project and save')).toBeVisible();
  });

  test('AI text analysis can input text', async ({ page }) => {
    await page.goto('/dashboard/analyzer');

    // Should be on AI Text Analysis tab by default
    const textarea = page.getByPlaceholder(/Paste your PRD/);
    await textarea.fill('# Test Project\n\n## Features\n- User login\n- Dashboard\n- Reports');

    // Verify character count updates
    await expect(page.getByText(/characters/)).toBeVisible();

    // Analyze button should be enabled
    const analyzeButton = page.getByRole('button', { name: /Analyze .* Extract Tasks/ });
    await expect(analyzeButton).toBeEnabled();
  });

  test('hourly rate can be modified', async ({ page }) => {
    await page.goto('/dashboard/analyzer');

    const hourlyRateInput = page.getByRole('spinbutton').first();
    await hourlyRateInput.clear();
    await hourlyRateInput.fill('200');

    await expect(hourlyRateInput).toHaveValue('200');
  });

  test('project context can be entered', async ({ page }) => {
    await page.goto('/dashboard/analyzer');

    const contextInput = page.getByPlaceholder(/Project context/);
    await contextInput.fill('React + TypeScript web application');

    await expect(contextInput).toHaveValue('React + TypeScript web application');
  });

  test('review screen allows task selection toggling', async ({ page }) => {
    await page.goto('/dashboard/analyzer');

    // Create manual task and go to review
    await page.getByRole('button', { name: /Manual Entry/ }).click();
    await page.getByPlaceholder('Task title...').first().fill('Test task');
    await page.getByRole('button', { name: 'Review Tasks' }).click();

    // Verify select all/deselect all buttons exist
    await expect(page.getByRole('button', { name: 'Select All' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Deselect All' })).toBeVisible();

    // Verify task checkbox exists
    const checkbox = page.getByRole('checkbox').first();
    await expect(checkbox).toBeVisible();
    await expect(checkbox).toBeChecked();

    // Deselect all
    await page.getByRole('button', { name: 'Deselect All' }).click();
    await expect(checkbox).not.toBeChecked();

    // Select all
    await page.getByRole('button', { name: 'Select All' }).click();
    await expect(checkbox).toBeChecked();
  });

  test('review screen shows start over option', async ({ page }) => {
    await page.goto('/dashboard/analyzer');

    // Create manual task and go to review
    await page.getByRole('button', { name: /Manual Entry/ }).click();
    await page.getByPlaceholder('Task title...').first().fill('Test task');
    await page.getByRole('button', { name: 'Review Tasks' }).click();

    // Verify Start Over button
    const startOverButton = page.getByRole('button', { name: 'Start Over' });
    await expect(startOverButton).toBeVisible();

    // Click start over
    await startOverButton.click();

    // Should be back to manual entry view
    await expect(page.getByRole('heading', { name: 'Bulk Task Entry' })).toBeVisible();
  });

  test('save to project section shows both modes', async ({ page }) => {
    await page.goto('/dashboard/analyzer');

    // Create manual task and go to review
    await page.getByRole('button', { name: /Manual Entry/ }).click();
    await page.getByPlaceholder('Task title...').first().fill('Test task');
    await page.getByRole('button', { name: 'Review Tasks' }).click();

    // Verify save mode buttons
    const existingProjectButton = page.getByRole('button', { name: 'Save to existing project' });
    const newProjectButton = page.getByRole('button', { name: 'Auto-create new project and save' });

    await expect(existingProjectButton).toBeVisible();
    await expect(newProjectButton).toBeVisible();

    // Click new project mode
    await newProjectButton.click();

    // Should show new project fields
    await expect(page.getByPlaceholder(/e.g. B2B Portal/)).toBeVisible();
    await expect(page.getByText('Project Key')).toBeVisible();
  });

  test('task table shows task type and priority options', async ({ page }) => {
    await page.goto('/dashboard/analyzer');

    // Go to manual entry
    await page.getByRole('button', { name: /Manual Entry/ }).click();

    // Check type dropdown exists and has options
    const typeSelect = page.locator('select').first();
    await expect(typeSelect).toBeVisible();

    // Verify some type options exist (epic, feature, story, task, subtask, bug)
    const typeOptions = typeSelect.locator('option');
    await expect(typeOptions).toContainText(['epic', 'feature', 'story', 'task', 'subtask', 'bug']);

    // Check priority dropdown
    const prioritySelects = page.locator('select').nth(1);
    await expect(prioritySelects).toBeVisible();
  });

  test('manual task row can be removed', async ({ page }) => {
    await page.goto('/dashboard/analyzer');

    await page.getByRole('button', { name: /Manual Entry/ }).click();

    // Add a second row
    await page.getByRole('button', { name: /Add Row/ }).click();

    // Should have 2 rows now
    await expect(page.getByPlaceholder('Task title...')).toHaveCount(2);

    // Remove the second row (trash icon button)
    const deleteButtons = page.locator('button').filter({ has: page.locator('svg') });
    // Find trash button (last one should be for second row)
    await deleteButtons.last().click();

    // Should be back to 1 row
    await expect(page.getByPlaceholder('Task title...')).toHaveCount(1);
  });
});
