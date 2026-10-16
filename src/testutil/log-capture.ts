import { vi } from 'vitest';

// Captures what the structured server logger (#lib/server/log.ts) writes:
// one JSON object per line on stdout or stderr. Restore with
// vi.restoreAllMocks() in afterEach.

export type LogLine = Record<string, unknown>;

export function captureLogLines(): { lines: () => LogLine[]; raw: () => string } {
	const chunks: string[] = [];
	const record = (chunk: unknown) => {
		chunks.push(String(chunk));
		return true;
	};
	vi.spyOn(process.stdout, 'write').mockImplementation(record);
	vi.spyOn(process.stderr, 'write').mockImplementation(record);
	const raw = () => chunks.join('');
	return { raw, lines: () => parseLines(raw()) };
}

function parseLines(text: string): LogLine[] {
	return text
		.split('\n')
		.filter((line) => line.trim() !== '')
		.map(parseLine);
}

// A line that isn't JSON shows up as { notJson } so assertions fail on it
// rather than the parser throwing.
function parseLine(line: string): LogLine {
	try {
		return JSON.parse(line) as LogLine;
	} catch {
		return { notJson: line };
	}
}
