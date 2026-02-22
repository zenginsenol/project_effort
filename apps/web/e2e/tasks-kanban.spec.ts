import { expect, test } from '@playwright/test';

test.describe('Task CRUD operations', () => {
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    // Navigate to projects page and create a test project
    await page.goto('/dashboard/projects');
    await expect(page.getByRole('heading', { name: 'Kanban Project Dashboard' })).toBeVisible();

    const projectName = `Task Test Project ${Date.now()}`;
    const projectKey = 'TTP';

    await page.getByPlaceholder('Project Name').fill(projectName);
    await page.getByPlaceholder('KEY').fill(projectKey);
    await page.getByRole('button', { name: 'Create Project' }).click();

    // Wait for project creation
    await page.waitForTimeout(1000);

    // Navigate to the created project
    const kanbanLink = page.getByRole('link', { name: /Open Kanban Board/i }).first();
    await kanbanLink.click();

    // Extract project ID from URL
    await page.waitForURL('**/dashboard/projects/**');
    const url = page.url();
    projectId = url.split('/').pop()?.split('?')[0] ?? '';

    // Verify we're on the project detail page
    await expect(page.getByRole('heading', { name: projectName }).or(page.getByRole('heading', { name: 'Project Details' }))).toBeVisible();
  });

  test('create task flow', async ({ page }) => {
    // Verify create task form is visible
    await expect(page.getByRole('heading', { name: 'Create Task' })).toBeVisible();

    // Fill in task creation form
    const taskTitle = `E2E Test Task ${Date.now()}`;
    const taskDescription = 'E2E test task description';

    await page.getByPlaceholder('Task title').fill(taskTitle);
    await page.getByPlaceholder('Description (optional)').fill(taskDescription);

    // Select type and priority (defaults should be 'task' and 'medium')
    const typeSelect = page.locator('select').filter({ hasText: 'task' }).first();
    await typeSelect.selectOption('feature');

    const prioritySelect = page.locator('select').filter({ hasText: 'medium' }).first();
    await prioritySelect.selectOption('high');

    // Click create button
    await page.getByRole('button', { name: 'Create Task' }).click();

    // Wait for task to be created
    await page.waitForTimeout(1000);

    // Verify task appears in the list
    await expect(page.getByText(taskTitle)).toBeVisible();

    // Verify form was reset
    await expect(page.getByPlaceholder('Task title')).toHaveValue('');
  });

  test('read tasks in list view', async ({ page }) => {
    // Create a test task first
    const taskTitle = `Read Test Task ${Date.now()}`;
    await page.getByPlaceholder('Task title').fill(taskTitle);
    await page.getByRole('button', { name: 'Create Task' }).click();
    await page.waitForTimeout(1000);

    // Verify list view is active (should be default)
    await expect(page.getByRole('button', { name: /List/i })).toHaveClass(/indigo/);

    // Verify task appears in the list
    await expect(page.getByText(taskTitle)).toBeVisible();

    // Verify list headers are visible
    await expect(page.getByText('Title')).toBeVisible();
    await expect(page.getByText('Status')).toBeVisible();
    await expect(page.getByText('Type')).toBeVisible();
    await expect(page.getByText('Priority')).toBeVisible();
    await expect(page.getByText('Estimate')).toBeVisible();
  });

  test('update task details', async ({ page }) => {
    // Create a test task
    const originalTitle = `Update Test Task ${Date.now()}`;
    await page.getByPlaceholder('Task title').fill(originalTitle);
    await page.getByRole('button', { name: 'Create Task' }).click();
    await page.waitForTimeout(1000);

    // Click on the task to open detail panel
    await page.getByText(originalTitle).click();

    // Wait for detail panel to load
    await expect(page.getByRole('heading', { name: 'Task Detail' })).toBeVisible();

    // Update task details
    const updatedTitle = `Updated ${originalTitle}`;
    const titleInput = page.locator('label:has-text("Title") + input, label:has-text("Title") ~ input').first();
    await titleInput.fill(updatedTitle);

    const descriptionInput = page.locator('label:has-text("Description") + textarea, label:has-text("Description") ~ textarea').first();
    await descriptionInput.fill('Updated description');

    // Update status
    const statusSelect = page.locator('label:has-text("Status") + select, label:has-text("Status") ~ select').first();
    await statusSelect.selectOption('in_progress');

    // Save changes
    await page.getByRole('button', { name: 'Save' }).click();

    // Wait for save to complete
    await page.waitForTimeout(1000);

    // Verify updated title appears in the list
    await expect(page.getByText(updatedTitle)).toBeVisible();
  });

  test('delete task', async ({ page }) => {
    // Create a test task
    const taskTitle = `Delete Test Task ${Date.now()}`;
    await page.getByPlaceholder('Task title').fill(taskTitle);
    await page.getByRole('button', { name: 'Create Task' }).click();
    await page.waitForTimeout(1000);

    // Click on the task to open detail panel
    await page.getByText(taskTitle).click();
    await page.waitForTimeout(500);

    // Set up dialog handler before clicking delete
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('Delete this task permanently?');
      void dialog.accept();
    });

    // Click delete button
    await page.getByRole('button', { name: 'Delete' }).click();

    // Wait for deletion to complete
    await page.waitForTimeout(1000);

    // Verify task is no longer in the list
    await expect(page.getByText(taskTitle)).not.toBeVisible();
  });

  test('add estimate to task', async ({ page }) => {
    // Create a test task
    const taskTitle = `Estimate Test Task ${Date.now()}`;
    await page.getByPlaceholder('Task title').fill(taskTitle);
    await page.getByRole('button', { name: 'Create Task' }).click();
    await page.waitForTimeout(1000);

    // Click on the task to open detail panel
    await page.getByText(taskTitle).click();
    await page.waitForTimeout(500);

    // Enter manual estimates
    const pointsInput = page.locator('label:has-text("Estimated Points") + input, label:has-text("Estimated Points") ~ input').first();
    await pointsInput.fill('5');

    const hoursInput = page.locator('label:has-text("Estimated Hours") + input, label:has-text("Estimated Hours") ~ input').first();
    await hoursInput.fill('16');

    // Save changes
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Verify estimates appear in the list
    await expect(page.getByText('5 pt / 16 h')).toBeVisible();
  });

  test('use estimate presets', async ({ page }) => {
    // Create a test task
    const taskTitle = `Preset Test Task ${Date.now()}`;
    await page.getByPlaceholder('Task title').fill(taskTitle);
    await page.getByRole('button', { name: 'Create Task' }).click();
    await page.waitForTimeout(1000);

    // Click on the task to open detail panel
    await page.getByText(taskTitle).click();
    await page.waitForTimeout(500);

    // Click on M preset (3pt / 8h)
    await page.getByRole('button', { name: /M \(3pt \/ 8h\)/i }).click();

    // Verify values are filled
    const pointsInput = page.locator('label:has-text("Estimated Points") + input, label:has-text("Estimated Points") ~ input').first();
    await expect(pointsInput).toHaveValue('3');

    const hoursInput = page.locator('label:has-text("Estimated Hours") + input, label:has-text("Estimated Hours") ~ input').first();
    await expect(hoursInput).toHaveValue('8');

    // Save changes
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Verify estimates appear in the list
    await expect(page.getByText('3 pt / 8 h')).toBeVisible();
  });

  test('create subtask', async ({ page }) => {
    // Create a parent task
    const parentTitle = `Parent Task ${Date.now()}`;
    await page.getByPlaceholder('Task title').fill(parentTitle);
    await page.getByRole('button', { name: 'Create Task' }).click();
    await page.waitForTimeout(1000);

    // Click on the task to open detail panel
    await page.getByText(parentTitle).click();
    await page.waitForTimeout(500);

    // Verify subtasks section exists
    await expect(page.getByText(/Subtasks \(/i)).toBeVisible();

    // Add a subtask
    const subtaskTitle = `Subtask ${Date.now()}`;
    await page.getByPlaceholder('New subtask title').fill(subtaskTitle);
    await page.getByRole('button', { name: 'Add' }).click();

    // Wait for subtask creation
    await page.waitForTimeout(1000);

    // Verify subtask count increased
    await expect(page.getByText(/Subtasks \(1\)/i)).toBeVisible();

    // Verify input was cleared
    await expect(page.getByPlaceholder('New subtask title')).toHaveValue('');
  });
});

test.describe('Kanban board operations', () => {
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    // Navigate to projects page and create a test project
    await page.goto('/dashboard/projects');
    await expect(page.getByRole('heading', { name: 'Kanban Project Dashboard' })).toBeVisible();

    const projectName = `Kanban Test Project ${Date.now()}`;
    const projectKey = 'KTP';

    await page.getByPlaceholder('Project Name').fill(projectName);
    await page.getByPlaceholder('KEY').fill(projectKey);
    await page.getByRole('button', { name: 'Create Project' }).click();

    // Wait for project creation
    await page.waitForTimeout(1000);

    // Navigate to the created project
    const kanbanLink = page.getByRole('link', { name: /Open Kanban Board/i }).first();
    await kanbanLink.click();

    // Extract project ID from URL
    await page.waitForURL('**/dashboard/projects/**');
    const url = page.url();
    projectId = url.split('/').pop()?.split('?')[0] ?? '';

    // Verify we're on the project detail page
    await expect(page.getByRole('heading', { name: projectName }).or(page.getByRole('heading', { name: 'Project Details' }))).toBeVisible();
  });

  test('switch to board view', async ({ page }) => {
    // Verify list view is default
    await expect(page.getByRole('button', { name: /List/i })).toHaveClass(/indigo/);

    // Click board view button
    await page.getByRole('button', { name: /Board/i }).click();

    // Verify board view is active
    await expect(page.getByRole('button', { name: /Board/i })).toHaveClass(/emerald/);

    // Verify board columns are visible
    await expect(page.getByText('Backlog')).toBeVisible();
    await expect(page.getByText('To Do')).toBeVisible();
    await expect(page.getByText('In Progress')).toBeVisible();
    await expect(page.getByText('In Review')).toBeVisible();
    await expect(page.getByText('Done')).toBeVisible();
    await expect(page.getByText('Cancelled')).toBeVisible();
  });

  test('board displays tasks in correct columns', async ({ page }) => {
    // Create tasks with different statuses
    const backlogTask = `Backlog Task ${Date.now()}`;
    await page.getByPlaceholder('Task title').fill(backlogTask);
    await page.getByRole('button', { name: 'Create Task' }).click();
    await page.waitForTimeout(1000);

    // Switch to board view
    await page.getByRole('button', { name: /Board/i }).click();
    await page.waitForTimeout(500);

    // Verify task appears in Backlog column
    const backlogColumn = page.locator('div:has(> div:has-text("Backlog"))').first();
    await expect(backlogColumn.getByText(backlogTask)).toBeVisible();
  });

  test('drag and drop task between columns', async ({ page }) => {
    // Create a task
    const taskTitle = `Drag Test Task ${Date.now()}`;
    await page.getByPlaceholder('Task title').fill(taskTitle);
    await page.getByRole('button', { name: 'Create Task' }).click();
    await page.waitForTimeout(1000);

    // Switch to board view
    await page.getByRole('button', { name: /Board/i }).click();
    await page.waitForTimeout(500);

    // Locate the task card
    const taskCard = page.locator(`div:has-text("${taskTitle}")`).filter({ hasText: taskTitle }).first();

    // Verify task is in Backlog column initially
    const backlogColumn = page.locator('div:has(> div:has-text("Backlog"))').first();
    await expect(backlogColumn.getByText(taskTitle)).toBeVisible();

    // Find the To Do column drop zone
    const todoColumn = page.locator('div:has(> div:has-text("To Do"))').first();
    const todoDropZone = todoColumn.locator('.space-y-2').first();

    // Perform drag and drop
    await taskCard.dragTo(todoDropZone);

    // Wait for the mutation to complete
    await page.waitForTimeout(1000);

    // Verify task moved to To Do column
    await expect(todoColumn.getByText(taskTitle)).toBeVisible();

    // Verify task is no longer in Backlog column
    await expect(backlogColumn.getByText(taskTitle)).not.toBeVisible();
  });

  test('board column shows correct task count', async ({ page }) => {
    // Switch to board view
    await page.getByRole('button', { name: /Board/i }).click();
    await page.waitForTimeout(500);

    // Get initial backlog count
    const backlogColumn = page.locator('div:has(> div:has-text("Backlog"))').first();
    const backlogHeader = backlogColumn.locator('div:has-text("Backlog")').first();

    // Create a task (should go to backlog by default)
    const taskTitle = `Count Test Task ${Date.now()}`;
    await page.getByPlaceholder('Task title').fill(taskTitle);
    await page.getByRole('button', { name: 'Create Task' }).click();
    await page.waitForTimeout(1000);

    // Verify count badge updated (should show at least 1)
    const countBadge = backlogHeader.locator('.status-pill, span').last();
    const countText = await countBadge.textContent();
    expect(Number(countText)).toBeGreaterThanOrEqual(1);
  });

  test('clicking task in board view opens detail panel', async ({ page }) => {
    // Create a task
    const taskTitle = `Detail Panel Test ${Date.now()}`;
    await page.getByPlaceholder('Task title').fill(taskTitle);
    await page.getByRole('button', { name: 'Create Task' }).click();
    await page.waitForTimeout(1000);

    // Switch to board view
    await page.getByRole('button', { name: /Board/i }).click();
    await page.waitForTimeout(500);

    // Click on the task card
    const taskCard = page.locator(`div:has-text("${taskTitle}")`).filter({ hasText: taskTitle }).first();
    await taskCard.click();

    // Verify detail panel opened
    await expect(page.getByRole('heading', { name: 'Task Detail' })).toBeVisible();

    // Verify task title is shown in detail panel
    const titleInput = page.locator('label:has-text("Title") + input, label:has-text("Title") ~ input').first();
    await expect(titleInput).toHaveValue(taskTitle);
  });

  test('empty board columns show placeholder', async ({ page }) => {
    // Switch to board view
    await page.getByRole('button', { name: /Board/i }).click();
    await page.waitForTimeout(500);

    // Check for "No tasks" placeholder in empty columns
    // At least some columns should have the placeholder initially
    await expect(page.getByText('No tasks').first()).toBeVisible();
  });
});

test.describe('Task filtering and sorting', () => {
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    // Navigate to projects page and create a test project
    await page.goto('/dashboard/projects');
    await expect(page.getByRole('heading', { name: 'Kanban Project Dashboard' })).toBeVisible();

    const projectName = `Filter Test Project ${Date.now()}`;
    const projectKey = 'FTP';

    await page.getByPlaceholder('Project Name').fill(projectName);
    await page.getByPlaceholder('KEY').fill(projectKey);
    await page.getByRole('button', { name: 'Create Project' }).click();

    // Wait for project creation
    await page.waitForTimeout(1000);

    // Navigate to the created project
    const kanbanLink = page.getByRole('link', { name: /Open Kanban Board/i }).first();
    await kanbanLink.click();

    // Extract project ID from URL
    await page.waitForURL('**/dashboard/projects/**');
    const url = page.url();
    projectId = url.split('/').pop()?.split('?')[0] ?? '';

    // Create multiple tasks with different statuses and types
    const tasks = [
      { title: 'Bug Task', type: 'bug', status: 'todo' },
      { title: 'Feature Task', type: 'feature', status: 'in_progress' },
      { title: 'Story Task', type: 'story', status: 'backlog' },
    ];

    for (const task of tasks) {
      await page.getByPlaceholder('Task title').fill(task.title);
      const typeSelect = page.locator('select').filter({ hasText: 'task' }).first();
      await typeSelect.selectOption(task.type);
      await page.getByRole('button', { name: 'Create Task' }).click();
      await page.waitForTimeout(500);

      // Update status if not backlog
      if (task.status !== 'backlog') {
        await page.getByText(task.title).click();
        await page.waitForTimeout(300);
        const statusSelect = page.locator('label:has-text("Status") + select, label:has-text("Status") ~ select').first();
        await statusSelect.selectOption(task.status);
        await page.getByRole('button', { name: 'Save' }).click();
        await page.waitForTimeout(500);
      }
    }

    await page.waitForTimeout(1000);
  });

  test('filter tasks by status', async ({ page }) => {
    // Get the status filter dropdown
    const statusFilter = page.locator('select').filter({ hasText: 'All Statuses' }).first();

    // Filter by 'todo' status
    await statusFilter.selectOption('todo');
    await page.waitForTimeout(500);

    // Verify only todo tasks are visible
    await expect(page.getByText('Bug Task')).toBeVisible();
    await expect(page.getByText('Feature Task')).not.toBeVisible();
    await expect(page.getByText('Story Task')).not.toBeVisible();

    // Verify URL updated with filter
    expect(page.url()).toContain('status=todo');
  });

  test('filter tasks by type', async ({ page }) => {
    // Get the type filter dropdown
    const typeFilter = page.locator('select').filter({ hasText: 'All Types' }).first();

    // Filter by 'bug' type
    await typeFilter.selectOption('bug');
    await page.waitForTimeout(500);

    // Verify only bug tasks are visible
    await expect(page.getByText('Bug Task')).toBeVisible();
    await expect(page.getByText('Feature Task')).not.toBeVisible();
    await expect(page.getByText('Story Task')).not.toBeVisible();

    // Verify URL updated with filter
    expect(page.url()).toContain('type=bug');
  });

  test('sort tasks by title', async ({ page }) => {
    // Get the sort dropdown
    const sortDropdown = page.locator('select').filter({ hasText: 'Newest First' }).first();

    // Sort by title A-Z
    await sortDropdown.selectOption('title_asc');
    await page.waitForTimeout(500);

    // Get all task titles in the list
    const taskRows = page.locator('button[type="button"]').filter({ hasText: 'Task' });
    const firstTask = taskRows.first();
    const firstTaskText = await firstTask.textContent();

    // Verify first task is alphabetically first (Bug Task should come before Feature Task)
    expect(firstTaskText).toContain('Bug');

    // Verify URL updated with sort
    expect(page.url()).toContain('sort=title_asc');
  });

  test('combined filters and sort', async ({ page }) => {
    // Apply type filter
    const typeFilter = page.locator('select').filter({ hasText: 'All Types' }).first();
    await typeFilter.selectOption('feature');

    // Apply sort
    const sortDropdown = page.locator('select').filter({ hasText: 'Newest First' }).first();
    await sortDropdown.selectOption('priority_desc');

    await page.waitForTimeout(500);

    // Verify URL contains both parameters
    expect(page.url()).toContain('type=feature');
    expect(page.url()).toContain('sort=priority_desc');

    // Verify only feature tasks are visible
    await expect(page.getByText('Feature Task')).toBeVisible();
    await expect(page.getByText('Bug Task')).not.toBeVisible();
    await expect(page.getByText('Story Task')).not.toBeVisible();
  });

  test('clear filters returns all tasks', async ({ page }) => {
    // Apply a filter
    const typeFilter = page.locator('select').filter({ hasText: 'All Types' }).first();
    await typeFilter.selectOption('bug');
    await page.waitForTimeout(500);

    // Verify filtered view
    await expect(page.getByText('Bug Task')).toBeVisible();
    await expect(page.getByText('Feature Task')).not.toBeVisible();

    // Clear filter
    await typeFilter.selectOption('');
    await page.waitForTimeout(500);

    // Verify all tasks are visible again
    await expect(page.getByText('Bug Task')).toBeVisible();
    await expect(page.getByText('Feature Task')).toBeVisible();
    await expect(page.getByText('Story Task')).toBeVisible();
  });

  test('view preference persists in URL', async ({ page }) => {
    // Switch to board view
    await page.getByRole('button', { name: /Board/i }).click();
    await page.waitForTimeout(500);

    // Verify URL updated
    expect(page.url()).toContain('view=board');

    // Reload page
    await page.reload();
    await page.waitForTimeout(1000);

    // Verify board view is still active
    await expect(page.getByRole('button', { name: /Board/i })).toHaveClass(/emerald/);
    await expect(page.getByText('Backlog')).toBeVisible();
  });
});
