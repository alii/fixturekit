export function extractDestructuredParams(str: string): string[] {
	str = str.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
	str = str.replace(/\s+/g, ' ').trim();

	const pattern = /[({]\s*{\s*(.*?)}\s*[)}]/;
	const match = str.match(pattern);

	if (!match?.[1]) {
		return [];
	}

	const params: string[] = [];

	let currentParam = '';
	let nestLevel = 0;

	for (const char of match[1]) {
		if (char === '{') {
			nestLevel++;
		} else if (char === '}') {
			nestLevel--;
		} else if (char === ',' && nestLevel === 0) {
			if (currentParam.trim()) {
				params.push(processParam(currentParam.trim()));
			}
			currentParam = '';
			continue;
		}

		currentParam += char;
	}

	if (currentParam.trim()) {
		params.push(processParam(currentParam.trim()));
	}

	return params.filter(Boolean);
}

function processParam(param: string): string {
	param = param.trim();
	if (!param) return '';

	if (param.startsWith('...')) {
		return param;
	}

	// handle nested destructuring: take only the part before the first brace
	const braceIndex = param.indexOf('{');
	if (braceIndex !== -1) {
		param = param.substring(0, braceIndex).trim();
	}

	// handle type annotations: remove everything after the closing brace
	const closingBraceIndex = param.lastIndexOf('}');
	if (closingBraceIndex !== -1) {
		param = param.substring(0, closingBraceIndex).trim();
	}

	const colonIndex = param.indexOf(':');
	if (colonIndex !== -1) {
		param = param.substring(0, colonIndex).trim();
	}

	const equalsIndex = param.indexOf('=');
	if (equalsIndex !== -1) {
		param = param.substring(0, equalsIndex).trim();
	}

	return param;
}

function deferred<T = void>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: Error) => void;

	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return { promise, resolve, reject };
}

export function validateKey(key: PropertyKey) {
	if (key.toString().includes('...')) {
		throw new Error('Spread operator is not allowed in fixture keys');
	}
}

export type FixtureGetter<Fixtures extends { [key in string]: any }, K extends keyof Fixtures> = (
	use: (value: Fixtures[K]) => Promise<void>,
	deps: Omit<Fixtures, K>
) => Promise<void>;

export type FixturesFunction<Fixtures extends { [key in string]: any }> = <
	const Keys extends keyof Fixtures,
	Args extends unknown[],
	Result
>(
	fn: (fixtures: { [K in Keys]: Fixtures[K] }, ...args: Args) => Result
) => (...args: Args) => Promise<Result>;

function extractDependencies(fn: Function): string[] {
	const fnStr = fn.toString();
	// match both arrow functions and regular functions, with or without async
	const match = fnStr.match(/(?:async\s*)?(?:function\s*)?\(\s*use\s*,\s*{\s*([^}]*)\s*}\s*\)/);
	if (!match?.[1]) return [];
	return match[1]
		.split(',')
		.map(s => s.trim())
		.filter(Boolean);
}

function topologicalSort<T extends PropertyKey>(nodes: T[], edges: Map<T, T[]>): T[] {
	const visited = new Set<T>();
	const temp = new Set<T>();
	const result: T[] = [];

	function visit(node: T) {
		if (temp.has(node)) {
			throw new Error(`Circular dependency detected involving fixture "${String(node)}"`);
		}

		if (visited.has(node)) {
			return;
		}

		temp.add(node);

		const deps = edges.get(node) || [];

		for (const dep of deps) {
			visit(dep);
		}

		temp.delete(node);
		visited.add(node);
		result.push(node);
	}

	for (const node of nodes) {
		if (!visited.has(node)) {
			visit(node);
		}
	}

	return result;
}

export function fixtures<
	Fixtures extends {
		[key in string]: any;
	}
>(getters: {
	[FixtureKey in keyof Fixtures]: FixtureGetter<Fixtures, FixtureKey>;
}): FixturesFunction<Fixtures> {
	const depGraph = new Map<keyof Fixtures, (keyof Fixtures)[]>();
	for (const [key, getter] of Object.entries(getters)) {
		const deps = extractDependencies(getter);
		depGraph.set(key, deps);
	}

	return <const Keys extends keyof Fixtures, Args extends unknown[], Result>(
		fn: (
			fixtures: {
				[K in Keys]: Fixtures[K];
			},
			...args: Args
		) => Result
	) => {
		const requestedKeys = extractDestructuredParams(fn.toString()) as Keys[];

		for (const key of requestedKeys) {
			validateKey(key);
		}

		return async (...args: Args) => {
			const fixtures: { [K in Keys]: Fixtures[K] | undefined } = {} as any;
			const teardowns: (() => Promise<void>)[] = [];
			const allKeys = new Set<Keys>();
			const setupPromises = new Map<Keys, Promise<void>>();

			const requiredKeys = new Set<Keys>();

			function collectDeps(key: Keys) {
				if (requiredKeys.has(key)) return;
				requiredKeys.add(key);

				const deps = depGraph.get(key) || [];

				for (const dep of deps) {
					collectDeps(dep as Keys);
				}
			}

			for (const key of requestedKeys) {
				collectDeps(key);
			}

			const sortedKeys = topologicalSort(Array.from(requiredKeys), depGraph as Map<Keys, Keys[]>);

			for (const key of sortedKeys) {
				if (setupPromises.has(key)) {
					continue;
				}

				const { promise: setupDone, resolve: resolveSetup } = deferred<void>();
				setupPromises.set(key, setupDone);

				const depsObj = Object.fromEntries(
					Array.from(requiredKeys)
						.filter(k => k !== key)
						.map(k => [k, fixtures[k]])
				) as Omit<Fixtures, typeof key>;

				const { promise: teardownDone, resolve: resolveTeardown } = deferred<void>();
				let useCalled = false;

				const use = async (value: Fixtures[typeof key]) => {
					if (useCalled) {
						throw new Error('Cannot call use() more than once');
					}
					useCalled = true;
					fixtures[key] = value;
					resolveSetup();
					await teardownDone;
				};

				const teardownPromise = (async () => {
					await getters[key](use, depsObj);

					if (!useCalled) {
						resolveSetup();
					}
				})();

				teardowns.unshift(() => {
					resolveTeardown();
					return teardownPromise;
				});

				allKeys.add(key);

				await setupDone;
			}

			const result = await fn(
				fixtures as {
					[K in Keys]: Fixtures[K];
				},
				...args
			);

			// Tear down in dependency order (already reversed by unshift)
			for (const teardown of teardowns) {
				await teardown();
			}

			return result;
		};
	};
}
