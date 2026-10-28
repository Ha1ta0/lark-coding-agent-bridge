import { describe, expect, it } from 'vitest';
import { translateQoderEvent } from '../../../src/agent/qodercli/stream-json.js';

describe('Qoder stream-json translator', () => {
  it('marks only end_turn assistant text as the final answer', () => {
    expect([
      ...translateQoderEvent({
        type: 'assistant',
        message: { stop_reason: null, content: [{ type: 'text', text: 'progress' }] },
      }),
    ]).toEqual([{ type: 'text', delta: 'progress' }]);

    expect([
      ...translateQoderEvent({
        type: 'assistant',
        message: { stop_reason: 'end_turn', content: [{ type: 'text', text: 'final answer' }] },
      }),
    ]).toEqual([
      { type: 'text', delta: 'final answer' },
      { type: 'final_text', content: 'final answer' },
    ]);
  });

  it('uses a successful result as a final-answer fallback', () => {
    expect([
      ...translateQoderEvent({
        type: 'result',
        subtype: 'success',
        session_id: 'session-1',
        result: 'result answer',
        usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 3 },
        total_cost_usd: 0.5,
      }),
    ]).toEqual([
      { type: 'usage', inputTokens: 10, outputTokens: 20, cachedInputTokens: 3, costUsd: 0.5 },
      { type: 'final_text', content: 'result answer' },
      { type: 'done', sessionId: 'session-1', terminationReason: 'normal' },
    ]);
  });

  it('maps error results to failed termination without a final answer', () => {
    expect([
      ...translateQoderEvent({
        type: 'result',
        subtype: 'error_max_turns',
        session_id: 'session-2',
        result: 'maximum turns reached',
      }),
    ]).toEqual([
      { type: 'error', message: 'maximum turns reached', terminationReason: 'failed' },
    ]);

    expect([
      ...translateQoderEvent({
        type: 'result',
        subtype: 'success',
        is_error: true,
        error: 'transport failed',
        result: 'not an answer',
      }),
    ]).toEqual([
      { type: 'error', message: 'transport failed', terminationReason: 'failed' },
    ]);
  });

  it('keeps Claude-compatible events unchanged', () => {
    expect([
      ...translateQoderEvent({
        type: 'assistant',
        message: {
          content: [{ type: 'tool_use', id: 'tool-1', name: 'Bash', input: { command: 'pwd' } }],
        },
      }),
    ]).toEqual([
      { type: 'tool_use', id: 'tool-1', name: 'Bash', input: { command: 'pwd' } },
    ]);
  });
});
