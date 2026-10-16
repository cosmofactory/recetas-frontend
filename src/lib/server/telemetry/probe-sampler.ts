import type { Attributes } from '@opentelemetry/api';
import {
	ParentBasedSampler,
	SamplingDecision,
	type Sampler,
	type SamplingResult
} from '@opentelemetry/sdk-trace-node';

// The Docker healthcheck and uptime checks hit /healthz and /readyz every few
// seconds; tracing them would bury real traffic (BE-1 skips them too). Kit
// names the route of its root span in `http.route`. Every other request is
// sampled, and child spans follow their local parent's decision. A remote
// parent (an incoming `traceparent`) is treated as no parent: the frontend is
// the public edge, so a client's sampled flag never decides what we record.

const PROBE_ROUTES = new Set(['/healthz', '/readyz']);
const ROUTE_ATTRIBUTE = 'http.route';

const probeRootSampler: Sampler = {
	// The positional signature is OTel's Sampler interface.
	// eslint-disable-next-line max-params
	shouldSample(_context, _traceId, _name, _kind, attributes: Attributes): SamplingResult {
		const route = attributes[ROUTE_ATTRIBUTE];
		const isProbe = typeof route === 'string' && PROBE_ROUTES.has(route);
		return {
			decision: isProbe ? SamplingDecision.NOT_RECORD : SamplingDecision.RECORD_AND_SAMPLED
		};
	},
	toString: () => 'ProbeSkippingRootSampler'
};

export function probeSkippingSampler(): Sampler {
	return new ParentBasedSampler({
		root: probeRootSampler,
		remoteParentSampled: probeRootSampler,
		remoteParentNotSampled: probeRootSampler
	});
}
