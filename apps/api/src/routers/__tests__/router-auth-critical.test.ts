import { afterEach, describe, expect, it, vi } from 'vitest';

import { appRouter } from '../index';
import { sessionService } from '../session/service';
import { taskService } from '../task/service';
import { teamService } from '../team/service';

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ORG_ID = '22222222-2222-2222-2222-222222222222';
const TASK_ID = '33333333-3333-4333-8333-333333333333';
const SESSION_ID = '44444444-4444-4444-8444-444444444444';
const USER_ID = '55555555-5555-4555-8555-555555555555';

function createCaller(orgId: string = ORG_ID) {
  return appRouter.createCaller({
    req: {} as never,
    res: {} as never,
    userId: 'clerk_user_1',
    orgId,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Router auth guards', () => {
  it('blocks team.list when organization payload mismatches ctx org', async () => {
    const listSpy = vi.spyOn(teamService, 'listMembers');
    const caller = createCaller(ORG_ID);

    await expect(caller.team.list({ organizationId: OTHER_ORG_ID })).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Organization mismatch',
    });

    expect(listSpy).not.toHaveBeenCalled();
  });

  it('passes ctx orgId into task.getById service call', async () => {
    const mockedTask = { id: TASK_ID, title: 'Task A' } as never;
    const getTaskSpy = vi.spyOn(taskService, 'getById').mockResolvedValue(mockedTask);
    const caller = createCaller(ORG_ID);

    const result = await caller.task.getById({ id: TASK_ID });

    expect(result).toBe(mockedTask);
    expect(getTaskSpy).toHaveBeenCalledWith(TASK_ID, ORG_ID);
  });

  it('returns NOT_FOUND when task service cannot find requested task', async () => {
    vi.spyOn(taskService, 'getById').mockResolvedValue(null);
    const caller = createCaller(ORG_ID);

    await expect(caller.task.getById({ id: TASK_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Task not found',
    });
  });
});

describe('Router critical paths', () => {
  it('routes session.vote through service with correct tenant context', async () => {
    const voteSpy = vi.spyOn(sessionService, 'submitVote').mockResolvedValue({ id: 'vote-1' } as never);
    const caller = createCaller(ORG_ID);

    const payload = {
      sessionId: SESSION_ID,
      userId: USER_ID,
      round: 1,
      value: '5',
    };

    const result = await caller.session.vote(payload);

    expect(result).toMatchObject({ id: 'vote-1' });
    expect(voteSpy).toHaveBeenCalledWith(SESSION_ID, USER_ID, 1, '5', ORG_ID);
  });

  it('returns NOT_FOUND when session.vote service returns null', async () => {
    vi.spyOn(sessionService, 'submitVote').mockResolvedValue(null);
    const caller = createCaller(ORG_ID);

    await expect(caller.session.vote({
      sessionId: SESSION_ID,
      userId: USER_ID,
      round: 1,
      value: '8',
    })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Session not found',
    });
  });
});
