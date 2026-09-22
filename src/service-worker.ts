/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { base, build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

/**
 * One cache for the whole app, not one per deploy.
 *
 * A per-deploy cache name only gets cleaned up when the new worker activates, and a worker
 * that never calls skipWaiting() only activates once every client is closed — which on an
 * installed iOS web app can be weeks. That left a fresh ~950 KB cache stranded per deploy.
 * With a stable name, install adds the new deploy's assets alongside the old ones and
 * activate prunes whatever is no longer referenced.
 */
const CACHE = 'aws-quiz-v1';

/**
 * The SPA shell. `adapter-static` is configured with `fallback: 'index.html'`, so there are
 * no per-route HTML files and `prerendered` is empty — every navigation has to be answered
 * with this one document.
 */
const SHELL = `${base}/`;

/**
 * Names the deploy whose worker is actually serving pages, so the settings card can report
 * it. Written from `activate`, not `install`: a worker that has installed but is still
 * waiting is not the one answering fetches, and this app can sit in that state for a long
 * time because it never calls skipWaiting().
 */
const VERSION_KEY = `${base}/__sw-version`;

/** Content-hashed build output. A hit is always the right answer, so serve it cache-first. */
const IMMUTABLE = new Set(build);

/**
 * Everything the app needs to boot with no network. `files` (icons, manifest, robots.txt)
 * is precached for offline availability but deliberately not treated as immutable — those
 * paths are stable, so their contents can change between deploys.
 */
const PRECACHE = [...build, ...files, SHELL];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(PRECACHE);
		})()
	);
	// No skipWaiting: the running session keeps the worker it started with, so a deploy can
	// never swap the app out mid-quiz. Freshness does not depend on this — navigations are
	// network-first, so a reload picks up the new deploy either way.
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			await Promise.all(
				(await caches.keys()).filter((key) => key !== CACHE).map((key) => caches.delete(key))
			);

			// Activation means every client from the previous deploy is gone, so assets it
			// referenced are now safe to drop.
			const cache = await caches.open(CACHE);
			const keep = new Set([...PRECACHE, VERSION_KEY]);
			await Promise.all(
				(await cache.keys())
					.filter((request) => !keep.has(new URL(request.url).pathname))
					.map((request) => cache.delete(request))
			);

			await cache.put(VERSION_KEY, new Response(version));
		})()
	);
	// No clients.claim(), for the same reason as skipWaiting above.
});

/**
 * Cache writes are handed to `event.waitUntil` rather than left floating: `respondWith`
 * settles as soon as the response is returned, and the browser is free to kill the worker
 * at that point, which would drop the write and leave an asset uncached that the offline
 * card has already implied is safe. The catch is for a full storage jar — small on an
 * installed iOS app — and for responses `Cache.put` refuses, such as a 206.
 */
function store(event: FetchEvent, cache: Cache, key: Request | string, response: Response) {
	event.waitUntil(cache.put(key, response.clone()).catch(() => undefined));
}

async function cacheFirst(event: FetchEvent, request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);
	const cached = await cache.match(request);
	if (cached) return cached;

	const response = await fetch(request);
	if (response.ok) store(event, cache, request, response);
	return response;
}

async function networkFirst(
	event: FetchEvent,
	request: Request,
	fallbackKey?: string
): Promise<Response> {
	const cache = await caches.open(CACHE);
	try {
		const response = await fetch(request);
		if (response.ok) {
			store(event, cache, fallbackKey ?? request, response);
			return response;
		}
		// A navigation that 404s means the host is not rewriting unknown paths to the shell.
		// The cached shell can still render the route, so prefer it over the error page.
		const cached = fallbackKey ? await cache.match(fallbackKey) : undefined;
		return cached ?? response;
	} catch (error) {
		const cached = await cache.match(fallbackKey ?? request);
		if (cached) return cached;
		throw error;
	}
}

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (!url.protocol.startsWith('http')) return;
	if (url.origin !== location.origin) return;

	// SvelteKit polls this to detect a redeploy. A cached copy would pin it to a stale
	// value forever, so let it go to the network and fail honestly when offline.
	if (url.pathname.endsWith('/_app/version.json')) return;

	if (IMMUTABLE.has(url.pathname)) {
		event.respondWith(cacheFirst(event, request));
		return;
	}

	// Deep links like /quiz and /review have no file of their own. Network-first keeps the
	// shell current — cache-first here would pin the app to the deploy it first cached —
	// and the cached shell is what makes those URLs work on a plane.
	if (request.mode === 'navigate') {
		event.respondWith(networkFirst(event, request, SHELL));
		return;
	}

	event.respondWith(networkFirst(event, request));
});
