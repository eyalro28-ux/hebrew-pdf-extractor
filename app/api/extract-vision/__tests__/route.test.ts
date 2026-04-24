import { describe, it, expect } from 'vitest';
import { POST } from '../route';

describe('POST /api/extract-vision', () => {
  it('returns 501 Not Implemented', async () => {
    const response = await POST();
    expect(response.status).toBe(501);
  });

  it('returns error message in JSON body', async () => {
    const response = await POST();
    const body = await response.json();
    expect(body.error).toContain('not yet implemented');
  });
});
