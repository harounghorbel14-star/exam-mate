import { describe, it, expect, beforeAll } from 'vitest';
import { app, makeUser, auth, request, type TestUser } from './helpers.js';
import { drain } from '../services/jobs.js';

/** Every protected resource must be invisible to other users and to anonymous callers. */
describe('authorization', () => {
  let alice: TestUser;
  let bob: TestUser;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    alice = await makeUser();
    bob = await makeUser();
    const doc = await request(app).post('/api/documents').set(auth(alice)).attach('file', Buffer.from('Photosynthesis is the process plants use to make food from light.'), 'notes.txt');
    ids.document = doc.body.document.id;
    await drain();
    ids.question = (await request(app).post('/api/solve').set(auth(alice)).send({ question: '2x + 1 = 5' })).body.questionId;
    ids.solution = (await request(app).get(`/api/questions/${ids.question}`).set(auth(alice))).body.solutions[0].id;
    ids.deck = (await request(app).post('/api/flashcards/decks').set(auth(alice)).send({ title: 'Deck', cards: [{ front: 'a', back: 'b' }] })).body.deck.id;
    ids.card = (await request(app).get(`/api/flashcards/decks/${ids.deck}/cards`).set(auth(alice))).body.cards[0].id;
    ids.attempt = (await request(app).post('/api/exams/attempts').set(auth(alice)).send({ count: 2 })).body.attempt.id;
    ids.note = (await request(app).post('/api/account/notes').set(auth(alice)).send({ title: 'n', body: 'b' })).body.note.id;
    await request(app).put('/api/account/memory').set(auth(alice)).send({ kind: 'note', key: 'k', value: 'v' });
    ids.memory = (await request(app).get('/api/account/memory').set(auth(alice))).body.items[0].id;
  });

  it("hides Alice's resources from Bob (404, never 200)", async () => {
    const attempts: Array<[string, string, object?]> = [
      ['get', `/api/documents/${ids.document}`], ['delete', `/api/documents/${ids.document}`], ['post', `/api/documents/${ids.document}/ask`, { question: 'photosynthesis?' }],
      ['post', `/api/documents/${ids.document}/summary`, {}], ['get', `/api/documents/${ids.document}/pages/1`],
      ['get', `/api/questions/${ids.question}`], ['patch', `/api/questions/${ids.question}`, { saved: true }], ['delete', `/api/questions/${ids.question}`],
      ['post', `/api/solutions/${ids.solution}/feedback`, { helpful: true }],
      ['get', `/api/flashcards/decks/${ids.deck}/cards`], ['delete', `/api/flashcards/decks/${ids.deck}`], ['post', `/api/flashcards/cards/${ids.card}/review`, { rating: 'good' }],
      ['put', `/api/flashcards/cards/${ids.card}`, { front: 'x', back: 'y' }],
      ['get', `/api/exams/attempts/${ids.attempt}`], ['post', `/api/exams/attempts/${ids.attempt}/submit`, {}], ['put', `/api/exams/attempts/${ids.attempt}/responses`, { responses: {} }],
      ['put', `/api/account/notes/${ids.note}`, { title: 'x', body: 'y', version: 1 }], ['delete', `/api/account/notes/${ids.note}`],
      ['delete', `/api/account/memory/${ids.memory}`],
    ];
    for (const [method, url, payload] of attempts) {
      const r = await (request(app) as unknown as Record<string, (u: string) => request.Test>)[method]!(url).set(auth(bob)).send(payload ?? {});
      expect(r.status, `${method.toUpperCase()} ${url}`).toBe(404);
    }
    // Lists never include other users' data.
    expect((await request(app).get('/api/documents').set(auth(bob))).body.items).toEqual([]);
    expect((await request(app).get('/api/questions').set(auth(bob))).body.items).toEqual([]);
    expect((await request(app).get('/api/flashcards/decks').set(auth(bob))).body.decks).toEqual([]);
    expect((await request(app).get('/api/account/notes').set(auth(bob))).body.notes).toEqual([]);
    // Retrieval is scoped: Bob's question cannot surface Alice's document.
    const s = await request(app).post('/api/solve').set(auth(bob)).send({ question: 'What is photosynthesis?' });
    expect(s.body.documentAnswer).toBeUndefined();
  });

  it('rejects anonymous access to every protected route', async () => {
    const routes = ['/api/account/profile', '/api/account/export', '/api/documents', '/api/questions', '/api/flashcards/decks', '/api/exams/attempts', '/api/progress/weaknesses', '/api/billing/subscription', '/api/agent/hardware'];
    for (const r of routes) expect((await request(app).get(r)).status, r).toBe(401);
    expect((await request(app).post('/api/solve').send({ question: '1+1' })).status).toBe(401);
  });

  it('restricts admin endpoints to admins', async () => {
    expect((await request(app).post('/api/agent/eval').set(auth(alice))).status).toBe(403);
    expect((await request(app).get('/api/agent/metrics').set(auth(alice))).status).toBe(403);
    const admin = await makeUser({ admin: true });
    expect((await request(app).get('/api/agent/metrics').set(auth(admin))).status).toBe(200);
  });

  it('rejects invalid ids instead of erroring', async () => {
    expect((await request(app).get('/api/documents/not-a-uuid').set(auth(alice))).status).toBe(400);
  });
});
