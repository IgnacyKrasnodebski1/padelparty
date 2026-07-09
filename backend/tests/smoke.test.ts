import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('smoke', () => {
  it('GET /healthz odpowiada ok', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe('padelparty-backend');
  });
});
