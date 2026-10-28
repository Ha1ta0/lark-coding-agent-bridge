import { translateEvent } from '../claude/stream-json';
import type { AgentEvent } from '../types';

interface QoderRawEvent {
  type?: string;
  subtype?: string;
  session_id?: string;
  is_error?: boolean;
  error?: string;
  result?: string;
  message?: {
    stop_reason?: string;
    content?: Array<{ type: string; text?: string }>;
  };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
  };
  total_cost_usd?: number;
}

export function* translateQoderEvent(raw: unknown): Generator<AgentEvent> {
  if (!raw || typeof raw !== 'object') return;
  const evt = raw as QoderRawEvent;

  if (evt.type === 'assistant') {
    yield* translateEvent(raw);
    if (evt.message?.stop_reason === 'end_turn') {
      const finalText = evt.message.content
        ?.filter((block) => block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('\n');
      if (finalText?.trim()) yield { type: 'final_text', content: finalText };
    }
    return;
  }

  if (evt.type === 'result') {
    if (evt.usage) {
      yield {
        type: 'usage',
        inputTokens: evt.usage.input_tokens,
        outputTokens: evt.usage.output_tokens,
        cachedInputTokens: evt.usage.cache_read_input_tokens,
        costUsd: evt.total_cost_usd,
      };
    }
    const failed = evt.is_error === true ||
      (typeof evt.subtype === 'string' && evt.subtype !== 'success');
    if (failed) {
      yield {
        type: 'error',
        message: evt.error ?? evt.result ?? `qodercli result: ${evt.subtype ?? 'unknown error'}`,
        terminationReason: 'failed',
      };
      return;
    }
    if (evt.result?.trim()) yield { type: 'final_text', content: evt.result };
    yield { type: 'done', sessionId: evt.session_id, terminationReason: 'normal' };
    return;
  }

  yield* translateEvent(raw);
}
