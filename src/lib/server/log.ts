import { trace } from '@opentelemetry/api';

// Server logs: one JSON object per line, shaped like the Go API's slog JSON
// (`time`, `level`, `msg`, then attributes) so one query works across both
// services. Inside an active span the line carries `trace_id` and `span_id`,
// which link it to the trace in Logfire (stack.md B7). INFO goes to stdout,
// WARN and ERROR to stderr; Docker collects both.

type Attrs = Record<string, unknown>;
type Level = 'INFO' | 'WARN' | 'ERROR';

// Set by the logger only; an attribute with one of these names is dropped.
const RESERVED_FIELDS = new Set(['time', 'level', 'msg', 'trace_id', 'span_id']);

export const log = {
	info: (msg: string, attrs?: Attrs) => write('INFO', msg, attrs),
	warn: (msg: string, attrs?: Attrs) => write('WARN', msg, attrs),
	error: (msg: string, attrs?: Attrs) => write('ERROR', msg, attrs)
};

function write(level: Level, msg: string, attrs: Attrs = {}): void {
	const line = {
		time: new Date().toISOString(),
		level,
		msg,
		...traceIds(),
		...callerFields(attrs)
	};
	const stream = level === 'INFO' ? process.stdout : process.stderr;
	stream.write(`${stringify(line)}\n`);
}

function callerFields(attrs: Attrs): Attrs {
	return Object.fromEntries(Object.entries(attrs).filter(([key]) => !RESERVED_FIELDS.has(key)));
}

// Logging must never fail the request: an attribute JSON can't encode (a
// cycle, a BigInt) costs the attributes, not the line.
function stringify(line: Attrs): string {
	try {
		return JSON.stringify(line, serialiseErrors);
	} catch (err) {
		const { time, level, msg, trace_id, span_id } = line;
		return JSON.stringify({ time, level, msg, trace_id, span_id, log_error: String(err) });
	}
}

function traceIds(): Attrs {
	const span = trace.getActiveSpan();
	if (!span) return {};
	const { traceId, spanId } = span.spanContext();
	return { trace_id: traceId, span_id: spanId };
}

// JSON.stringify drops an Error's own fields (they aren't enumerable); keep
// the name, message, stack and the chain of causes, which carry the detail.
function serialiseErrors(_key: string, value: unknown): unknown {
	if (!(value instanceof Error)) return value;
	return { name: value.name, message: value.message, stack: value.stack, cause: value.cause };
}
