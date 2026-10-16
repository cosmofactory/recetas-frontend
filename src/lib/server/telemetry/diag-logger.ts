import { DiagLogLevel, diag, type DiagLogger } from '@opentelemetry/api';
import { inspect } from 'node:util';
import { log } from '../log.ts';

// The OTel SDK reports its own trouble (a failed export, a rejected token)
// through `diag`. At WARN and above it goes to the structured logger; below
// that it is dropped. The token travels in the exporter's headers, so it and
// any Authorization header value are redacted from every message and argument.

const MESSAGE_PREFIX = 'otel: ';
const REDACTED = '[REDACTED]';
// `Authorization: x`, `authorization=x`, `"Authorization":"x"`, `Authorization: 'x'`.
const AUTHORIZATION_VALUE = /(authorization["']?\s*[:=]\s*["']?)[^"',}\s]+/gi;
const INSPECT_OPTIONS = { depth: 4, breakLength: Infinity };

type Write = (msg: string, attrs?: Record<string, unknown>) => void;

export function startDiagLogging(token: string): void {
	const redact = (text: string) =>
		text.split(token).join(REDACTED).replace(AUTHORIZATION_VALUE, `$1${REDACTED}`);
	const forward =
		(write: Write) =>
		(message: string, ...args: unknown[]) =>
			write(`${MESSAGE_PREFIX}${redact(message)}`, argsField(args, redact));
	const ignore = () => {};
	const logger: DiagLogger = {
		error: forward(log.error),
		warn: forward(log.warn),
		info: ignore,
		debug: ignore,
		verbose: ignore
	};
	diag.setLogger(logger, { logLevel: DiagLogLevel.WARN, suppressOverrideMessage: true });
}

function argsField(args: unknown[], redact: (text: string) => string) {
	if (args.length === 0) return undefined;
	return { args: args.map((arg) => redact(inspect(arg, INSPECT_OPTIONS))) };
}
