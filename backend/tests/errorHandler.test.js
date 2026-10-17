import request from 'supertest';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, test, vi } from 'vitest';

const require = createRequire(import.meta.url);
const app = require('../src/app.js');
const Event = require('../src/models/Event.js');

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('request parsing errors', () => {
  test('returns 413 for JSON exceeding the body limit', async () => {
    const res = await request(app)
      .post('/api/events')
      .send({ description: 'x'.repeat(110000) });

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'Request body too large' });
  });

  test('returns 415 for an unsupported content encoding', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Content-Encoding', 'unsupported')
      .send({});

    expect(res.status).toBe(415);
    expect(res.body).toEqual({ error: 'Unsupported content encoding' });
  });

  test('keeps malformed JSON responses at 400', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Content-Type', 'application/json')
      .send('{bad');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid JSON body' });
  });

  test('keeps unexpected failures at 500 without exposing production details', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Event, 'create').mockRejectedValue(new Error('Internal database detail'));

    const res = await request(app).post('/api/events').send({
      title: 'Test event',
      date: '2099-01-15',
      time: '18:30',
      location: 'Online',
      organizer: 'Test organizer',
      capacity: 10,
    });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });
});
