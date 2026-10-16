import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureLogLines } from '../../testutil/log-capture';
import { loadExport } from '../../testutil/load-export';
import { inActiveSpan, startTestTracing } from '../../testutil/otel';

// FE-2 observability (stack.md B7): server logs are one JSON object per line
// on stdout/stderr (what Docker collects), shaped like the Go API's slog JSON
// (`time`, `level`, `msg`, then attributes), so one query works across both.
// Inside an active span the line carries `trace_id` and `span_id`, which link
// it to the trace in Logfire (BE-1 does the same on the Go side).

type Attrs = Record<string, unknown>;
type Logger = {
	info: (msg: string, attrs?: Attrs) => void;
	error: (msg: string, attrs?: Attrs) => void;
};

const load = () => loadExport<Logger>('src/lib/server/log.ts', 'log');

afterEach(() => {
	vi.restoreAllMocks();
});

const levels = [
	{ method: 'info', level: 'INFO' },
	{ method: 'error', level: 'ERROR' }
] as const;

describe('log', () => {
	for (const { method, level } of levels) {
		it(`log.${method} writes exactly one JSON line with time, level ${level}, msg and the attributes`, async () => {
			const log = await load();
			const out = captureLogLines();
			log[method]('catalog unavailable', { route: '/[lang=lang]', status: 503 });
			expect(out.raw().endsWith('\n'), 'got no trailing newline').toBe(true);
			const lines = out.lines();
			expect(lines).toHaveLength(1);
			expect(lines[0]).toMatchObject({
				level,
				msg: 'catalog unavailable',
				route: '/[lang=lang]',
				status: 503
			});
			expect(Number.isNaN(Date.parse(String(lines[0].time))), `got time ${lines[0].time}`).toBe(
				false
			);
		});
	}

	it('serialises an Error attribute with its message and its causes', async () => {
		const log = await load();
		const out = captureLogLines();
		const err = new Error('backend unreachable', {
			cause: new TypeError('fetch failed', {
				cause: new Error('connect ECONNREFUSED 10.1.2.3:8080')
			})
		});
		log.error('catalog unavailable', { err });
		const text = out.raw();
		for (const part of ['backend unreachable', 'fetch failed', 'ECONNREFUSED']) {
			expect(text, `got ${text}, want it to contain ${part}`).toContain(part);
		}
	});

	it('has no trace_id or span_id outside a span', async () => {
		const log = await load();
		const out = captureLogLines();
		log.info('starting');
		expect(out.lines()[0]).not.toHaveProperty('trace_id');
		expect(out.lines()[0]).not.toHaveProperty('span_id');
	});

	it('carries the active span’s trace_id and span_id', async () => {
		const tracing = startTestTracing();
		try {
			const log = await load();
			const out = captureLogLines();
			const { parent } = await inActiveSpan(async () => log.error('catalog unavailable'));
			expect(out.lines()[0]).toMatchObject({ trace_id: parent.traceId, span_id: parent.spanId });
		} finally {
			await tracing.shutdown();
		}
	});

	// The envelope is the logger's: an attribute with a reserved name must not
	// turn an ERROR into an INFO or detach the line from its trace.
	it('caller attributes cannot overwrite time, level, msg, trace_id or span_id', async () => {
		const tracing = startTestTracing();
		try {
			const log = await load();
			const out = captureLogLines();
			const forged = {
				time: 'yesterday',
				level: 'INFO',
				msg: 'y',
				trace_id: '0'.repeat(32),
				span_id: '0'.repeat(16)
			};
			const { parent } = await inActiveSpan(async () => log.error('x', forged));
			const line = out.lines()[0];
			expect(line).toMatchObject({
				level: 'ERROR',
				msg: 'x',
				trace_id: parent.traceId,
				span_id: parent.spanId
			});
			expect(line.time).not.toBe('yesterday');
		} finally {
			await tracing.shutdown();
		}
	});
});
