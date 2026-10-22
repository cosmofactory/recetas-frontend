// The APP_ENV the e2e server runs with (playwright.config.ts). `demo`, as
// on demo.asadorov.es: robots disallows everything and every response
// carries X-Robots-Tag: noindex (FE-8). The prod mode is covered by the unit
// specs (robots.txt/server.spec.ts, hooks.server.robots.spec.ts).
export const APP_ENV = 'demo';
