// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// The root layout's load (+layout.server.ts): every page has it.
		interface PageData {
			origin: string;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
