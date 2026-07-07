import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { ExtractResponse, StreamEvent } from '@groweasy/shared';
import { createApp } from '../app.js';

const app = createApp();

const SAMPLE_CSV = [
  'Full Name,Email,Phone,Lead Status,City',
  'John Doe,john@x.com,+91 9876543210,Interested,Mumbai',
  'No Contact Person,,,Not interested,Delhi',
  'Jane Roe,jane@x.com,9123456789,Closed won,Pune',
].join('\n');

describe('GET /api/health', () => {
  it('reports heuristic mode when no API key is set', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.aiEnabled).toBe(false);
    expect(res.body.mode).toBe('heuristic');
  });
});

describe('POST /api/extract', () => {
  it('extracts records from a JSON csv body and applies the skip rule', async () => {
    const res = await request(app).post('/api/extract').send({ csv: SAMPLE_CSV });
    expect(res.status).toBe(200);
    const body = res.body as ExtractResponse;
    expect(body.summary.totalRows).toBe(3);
    expect(body.summary.imported).toBe(2);
    expect(body.summary.skipped).toBe(1);
    expect(body.records[0]?.name).toBe('John Doe');
    expect(body.records[0]?.mobile_without_country_code).toBe('9876543210');
    expect(body.skipped[0]?.rowIndex).toBe(1);
  });

  it('accepts a multipart file upload', async () => {
    const res = await request(app)
      .post('/api/extract')
      .attach('file', Buffer.from(SAMPLE_CSV), { filename: 'leads.csv', contentType: 'text/csv' });
    expect(res.status).toBe(200);
    expect((res.body as ExtractResponse).summary.imported).toBe(2);
  });

  it('returns 400 when no CSV is provided', async () => {
    const res = await request(app).post('/api/extract').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_CSV');
  });
});

describe('POST /api/extract/stream', () => {
  it('streams NDJSON events ending with a done summary', async () => {
    const res = await request(app).post('/api/extract/stream').send({ csv: SAMPLE_CSV });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/x-ndjson');

    const events = res.text
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as StreamEvent);

    expect(events[0]?.type).toBe('start');
    const done = events.find((e) => e.type === 'done');
    expect(done).toBeDefined();
    if (done?.type === 'done') {
      expect(done.summary.imported).toBe(2);
      expect(done.summary.skipped).toBe(1);
    }
  });
});
