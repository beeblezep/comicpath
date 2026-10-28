import { useState, useCallback, useRef } from 'react';
import { resolveIntent } from '../lib/api';

const IDLE = { status: 'idle', prompt: '', answers: [], question: null, error: null };

/**
 * Resolves a free-text request into seeds + mode, one clarifying question at a time.
 * status: idle → resolving → (clarifying → resolving)* → idle, calling onResolved
 * with { prompt, seeds, mode } once nothing is unclear. Errors land in status 'error'.
 */
export function useIntent(onResolved) {
  const [state, setState] = useState(IDLE);
  // Ignores replies to a request that was cancelled or replaced.
  const runRef = useRef(0);

  const step = useCallback(async (prompt, answers) => {
    const run = ++runRef.current;
    setState({ status: 'resolving', prompt, answers, question: null, error: null });
    try {
      const result = await resolveIntent(prompt, answers);
      if (run !== runRef.current) return;
      if (result.status === 'clarify') {
        setState({ status: 'clarifying', prompt, answers, question: result.question, error: null });
        return;
      }
      setState(IDLE);
      onResolved({ prompt, seeds: result.seeds, mode: result.mode });
    } catch (err) {
      if (run !== runRef.current) return;
      setState({ status: 'error', prompt, answers, question: null, error: err.message || 'Something went wrong.' });
    }
  }, [onResolved]);

  const start = useCallback((prompt) => step(prompt, []), [step]);

  const answer = useCallback((text) => {
    if (state.status !== 'clarifying') return;
    step(state.prompt, [...state.answers, { question: state.question.text, answer: text }]);
  }, [state, step]);

  // Re-asks after an error, keeping the answers given so far.
  const retry = useCallback(() => {
    if (state.status !== 'error') return;
    step(state.prompt, state.answers);
  }, [state, step]);

  const cancel = useCallback(() => {
    runRef.current++;
    setState(IDLE);
  }, []);

  return { ...state, start, answer, retry, cancel };
}
