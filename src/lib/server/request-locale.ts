import { AsyncLocalStorage } from 'node:async_hooks';
import { overwriteServerAsyncLocalStorage } from '#lib/paraglide/runtime.js';
import type { Locale } from '#lib/i18n/locales.ts';

// Paraglide's ParaglideAsyncLocalStorage type: `run` must accept its whole
// store shape. We only ever set `locale`; `origin` and `messageCalls` serve
// paraglideMiddleware features we don't use.
type Store = { locale?: Locale; origin?: string; messageCalls?: Set<string> };

// Paraglide's server-side locale store: m.*() and getLocale() read the
// locale of the request being rendered from it. We fill it ourselves instead
// of using paraglideMiddleware, whose redirects and URL de-localisation would
// fight the [lang=lang] routes, the `/` redirect and /healthz.
const store = new AsyncLocalStorage<Store>();
overwriteServerAsyncLocalStorage(store);

export function withRequestLocale<T>(locale: Locale, render: () => T): T {
	return store.run({ locale }, render);
}
