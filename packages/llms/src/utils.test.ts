import { describe, expect, it } from 'vitest'

import { getProvider, modelPatch, normalizeModelName, restoreAimlapiVersionDot } from './utils'

describe('normalizeModelName', () => {
	it.each([
		['gpt-5.2', 'gpt-52'],
		['gpt_5_2', 'gpt52'],
		['GPT-52-2026-01-01', 'gpt-52-2026-01-01'],
		['openai/gpt-5.2-chat', 'gpt-52-chat'],
		['claude_sonnet4_5', 'claudesonnet45'],
	])('%s -> %s', (input, expected) => {
		expect(normalizeModelName(input)).toBe(expected)
	})
})

describe('getProvider', () => {
	it.each([
		['https://openrouter.ai/api/v1', 'openrouter'],
		['https://api.aimlapi.com/v1', 'aimlapi'],
		['https://dashscope.aliyuncs.com/compatible-mode/v1', undefined],
		['http://localhost:11434/v1', undefined],
		['not a url', undefined],
		[undefined, undefined],
	])('%s -> %s', (baseURL, expected) => {
		expect(getProvider(baseURL)).toBe(expected)
	})
})

describe('restoreAimlapiVersionDot', () => {
	it.each([
		// aimlapi.com spells OpenAI's dotted versions with a dash
		['openai/gpt-5-4', 'openai/gpt-5.4'],
		['openai/gpt-5-5', 'openai/gpt-5.5'],
		['openai/gpt-4-1', 'openai/gpt-4.1'],
		// leave everything else alone
		['openai/gpt-5-mini', 'openai/gpt-5-mini'],
		['openai/gpt-5', 'openai/gpt-5'],
		['openai/gpt-5.4-mini', 'openai/gpt-5.4-mini'],
		['anthropic/claude-opus-4-8', 'anthropic/claude-opus-4-8'],
		['x-ai/grok-4-5', 'x-ai/grok-4-5'],
	])('%s -> %s', (input, expected) => {
		expect(restoreAimlapiVersionDot(input)).toBe(expected)
	})
})

describe('modelPatch on aimlapi.com', () => {
	const AIMLAPI = 'https://api.aimlapi.com/v1'

	it('lowers reasoning_effort "minimal" to "low"', () => {
		// aimlapi.com only accepts 'none' | 'low' | 'medium' | 'high'
		const body = modelPatch({ model: 'openai/gpt-5-mini' }, AIMLAPI)
		expect(body.reasoning_effort).toBe('low')
	})

	it('lowers reasoning_effort "minimal" to "low" for gemini 3.x flash', () => {
		const body = modelPatch({ model: 'google/gemini-3.5-flash' }, AIMLAPI)
		expect(body.reasoning_effort).toBe('low')
	})

	it('keeps "minimal" on providers that accept it', () => {
		const body = modelPatch({ model: 'openai/gpt-5-mini' }, 'https://openrouter.ai/api/v1')
		expect(body.reasoning_effort).toBe('minimal')
	})

	it('resolves dash-versioned OpenAI ids to their real model family', () => {
		// gpt-5.4+ rejects reasoning_effort when function tools are present, and
		// aimlapi.com publishes that model as `openai/gpt-5-4`
		const body = modelPatch({ model: 'openai/gpt-5-4', reasoning_effort: 'high' }, AIMLAPI)
		expect(body.reasoning_effort).toBeUndefined()
		expect(body.verbosity).toBe('low')
	})

	it('still treats plain gpt-5 as gpt-5', () => {
		const body = modelPatch({ model: 'openai/gpt-5' }, AIMLAPI)
		expect(body.reasoning_effort).toBe('low') // 'minimal', lowered above
	})

	it('does not send null for parameters it does not set', () => {
		// aimlapi.com rejects an explicit null on temperature/seed/tools/tool_choice
		// and several other fields with a 400 — unset keys must stay absent
		const body = modelPatch({ model: 'openai/gpt-5.4-mini' }, AIMLAPI)
		for (const value of Object.values(body)) expect(value).not.toBeNull()
	})
})
