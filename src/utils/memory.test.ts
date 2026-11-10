import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSystemInstruction,
  DEFAULT_INSTRUCTION_CONFIG,
  DEFAULT_PLAYER_STATE,
  extractPlayerSummary,
  filterRecentHistory,
} from './memory';
import type { ChatMessage } from '../types';

test('filterRecentHistory keeps only messages within 72 hours', () => {
  const now = 1_700_000_000_000;
  const hourMs = 60 * 60 * 1000;
  const messages: ChatMessage[] = [
    { id: '1', role: 'user', content: 'Old query', timestamp: now - 80 * hourMs },
    { id: '2', role: 'assistant', content: 'Recent reply', timestamp: now - 10 * hourMs },
    { id: '3', role: 'user', content: 'Boundary query', timestamp: now - 72 * hourMs },
  ];

  const recent = filterRecentHistory(messages, 72, now);
  assert.equal(recent.length, 2);
  assert.deepEqual(
    recent.map((m) => m.id),
    ['2', '3']
  );
});

test('extractPlayerSummary includes character location, level, gear, and recent queries', () => {
  const messages: ChatMessage[] = [
    { id: '1', role: 'user', content: 'Where is the Eternal Forge?', timestamp: 1000 },
  ];
  const summary = extractPlayerSummary(messages, DEFAULT_PLAYER_STATE);
  assert.match(summary, /Kaelen/);
  assert.match(summary, /Level 60/);
  assert.match(summary, /The Cinder Maw/);
  assert.match(summary, /Where is the Eternal Forge\?/);
});

test('buildSystemInstruction enforces strict WoW Forever lock and custom directives', () => {
  const instruction = buildSystemInstruction(
    {
      ...DEFAULT_INSTRUCTION_CONFIG,
      customDirectives: 'Always call out interrupt timings.',
    },
    DEFAULT_PLAYER_STATE,
    []
  );

  assert.match(instruction, /STRICT VERSION LOCK/);
  assert.match(instruction, /World of Warcraft: Forever/);
  assert.match(instruction, /Always call out interrupt timings\./);
  assert.match(instruction, /Last 72 Hours/);
});
