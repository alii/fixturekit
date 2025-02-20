import { describe, expect, test } from 'bun:test';
import { extractDestructuredParams, fixtures, FixtureTeardownFailureError } from './src/index.ts';

describe('extractDestructuredParams', () => {
	test('should extract params from function declaration', () => {
		const input = 'function x({ name, age }) {}';
		expect(extractDestructuredParams(input)).toEqual(['name', 'age']);
	});

	test('should extract params from arrow function', () => {
		const input = '({ name, age }) => {}';
		expect(extractDestructuredParams(input)).toEqual(['name', 'age']);
	});

	test('should handle single parameter', () => {
		const input = '({ name }) => {}';
		expect(extractDestructuredParams(input)).toEqual(['name']);
	});

	test('should handle spaces and newlines', () => {
		const input = `function test({
        firstName,
        lastName
      }) {}`;
		expect(extractDestructuredParams(input)).toEqual(['firstName', 'lastName']);
	});

	test('should handle empty destructuring', () => {
		const input = 'function empty({}) {}';
		expect(extractDestructuredParams(input)).toEqual([]);
	});

	test('should handle inline arrow function assignment', () => {
		const input = 'const fn = ({ data, type }) => {};';
		expect(extractDestructuredParams(input)).toEqual(['data', 'type']);
	});

	test('should return empty array for non-matching input', () => {
		const input = 'function regular(x, y) {}';
		expect(extractDestructuredParams(input)).toEqual([]);
	});

	test('should handle spread operator', () => {
		const input = 'function test({ name, ...rest }) {}';
		expect(extractDestructuredParams(input)).toEqual(['name', '...rest']);
	});

	test('should handle default values', () => {
		const input = 'function test({ name = "default", age = 20 }) {}';
		expect(extractDestructuredParams(input)).toEqual(['name', 'age']);
	});

	test('should handle nested destructuring', () => {
		const input = 'function test({ user: { name, age }, settings }) {}';
		expect(extractDestructuredParams(input)).toEqual(['user', 'settings']);
	});

	test('should handle deeply nested destructuring', () => {
		const input = 'function test({ user: { name, age }, settings: { theme } }) {}';
		expect(extractDestructuredParams(input)).toEqual(['user', 'settings']);
	});

	test('should handle renamed destructured parameters', () => {
		const input = 'function test({ name: userName, age: userAge }) {}';
		expect(extractDestructuredParams(input)).toEqual(['name', 'age']);
	});

	test('should handle complex mixed patterns', () => {
		const input = `
			function test({ 
				name = 'default',
				age: userAge,
				settings: { theme = 'dark' },
				...rest
			}) {}
		`;
		expect(extractDestructuredParams(input)).toEqual(['name', 'age', 'settings', '...rest']);
	});

	test('should handle invalid syntax gracefully', () => {
		const input = 'function test({ name, }) {}'; // trailing comma
		expect(extractDestructuredParams(input)).toEqual(['name']);
	});

	test('should handle malformed input gracefully', () => {
		const input = 'function test({ name,, age }) {}'; // double comma
		expect(extractDestructuredParams(input)).toEqual(['name', 'age']);
	});

	test('should handle completely invalid input', () => {
		const input = 'not a function at all';
		expect(extractDestructuredParams(input)).toEqual([]);
	});

	test('should handle async arrow functions', () => {
		const input = 'async ({ data, type }) => {}';
		expect(extractDestructuredParams(input)).toEqual(['data', 'type']);
	});

	test('should handle generator functions', () => {
		const input = 'function* test({ value, next }) {}';
		expect(extractDestructuredParams(input)).toEqual(['value', 'next']);
	});

	test('should handle async generator functions', () => {
		const input = 'async function* test({ stream, buffer }) {}';
		expect(extractDestructuredParams(input)).toEqual(['stream', 'buffer']);
	});

	test('should handle class methods', () => {
		const input = 'class Test { method({ prop, value }) {} }';
		expect(extractDestructuredParams(input)).toEqual(['prop', 'value']);
	});

	test('should handle object method shorthand', () => {
		const input = 'const obj = { method({ x, y }) {} }';
		expect(extractDestructuredParams(input)).toEqual(['x', 'y']);
	});

	test('should handle arrow function toString format', () => {
		const input = '({name}) => "hi"';
		expect(extractDestructuredParams(input)).toEqual(['name']);
	});

	test('should handle multiline arrow function toString format', () => {
		const input = '({firstName, lastName}) => {\n  return `${firstName} ${lastName}`;\n}';
		expect(extractDestructuredParams(input)).toEqual(['firstName', 'lastName']);
	});

	test('should handle arrow function with complex destructuring toString', () => {
		const input = '({user: { name, age }, settings: { theme }}) => ({})';
		expect(extractDestructuredParams(input)).toEqual(['user', 'settings']);
	});

	test('should handle arrow function with defaults toString', () => {
		const input = '({name = "John", age = 30}) => name + age';
		expect(extractDestructuredParams(input)).toEqual(['name', 'age']);
	});

	test('should handle arrow function with spread toString', () => {
		const input = '({name, ...rest}) => ({ user: name, settings: rest })';
		expect(extractDestructuredParams(input)).toEqual(['name', '...rest']);
	});

	test('should handle arrow function with renamed params toString', () => {
		const input = '({name: userName, age: userAge}) => userName';
		expect(extractDestructuredParams(input)).toEqual(['name', 'age']);
	});

	test('should handle arrow function with nested renaming toString', () => {
		const input = '({user: {name: userName, age: userAge}}) => userName';
		expect(extractDestructuredParams(input)).toEqual(['user']);
	});

	test('should handle async arrow function toString', () => {
		const input = 'async ({data, config}) => await process(data)';
		expect(extractDestructuredParams(input)).toEqual(['data', 'config']);
	});

	test('should handle arrow function with trailing comma toString', () => {
		const input = '({name, age,}) => name';
		expect(extractDestructuredParams(input)).toEqual(['name', 'age']);
	});

	test('should handle arrow function with multiple spaces toString', () => {
		const input = '({   name   ,    age   }) => name';
		expect(extractDestructuredParams(input)).toEqual(['name', 'age']);
	});

	test('should handle arrow function with comments toString', () => {
		const input = '({name /* user name */, age /* user age */}) => name';
		expect(extractDestructuredParams(input)).toEqual(['name', 'age']);
	});

	test('should handle arrow function with type annotations toString', () => {
		const input = '({name}: {name: string}) => name';
		expect(extractDestructuredParams(input)).toEqual(['name']);
	});

	test('should handle arrow function with empty object pattern toString', () => {
		const input = '({}) => "hello"';
		expect(extractDestructuredParams(input)).toEqual([]);
	});

	test('should handle arrow function with deeply nested spread toString', () => {
		const input = '({user: { ...userInfo }, settings: { ...configInfo }}) => ({})';
		expect(extractDestructuredParams(input)).toEqual(['user', 'settings']);
	});

	test('should handle arrow function with multiple nested spreads toString', () => {
		const input = '({...a, b: {...c}, ...d}) => ({})';
		expect(extractDestructuredParams(input)).toEqual(['...a', 'b', '...d']);
	});

	test('should handle function with no arguments', () => {
		const input = 'function test() {}';
		expect(extractDestructuredParams(input)).toEqual([]);
	});

	test('should handle arrow function with no arguments', () => {
		const input = '() => {}';
		expect(extractDestructuredParams(input)).toEqual([]);
	});
});

describe('fixture dependency graph', () => {
	test('should execute fixtures in correct dependency order', async () => {
		const executionOrder: string[] = [];

		const f = fixtures<{
			a: string;
			b: string;
			c: string;
			d: string;
		}>({
			a: async use => {
				executionOrder.push('a:setup');
				await use('a');
				executionOrder.push('a:teardown');
			},
			b: async (use, { a }) => {
				executionOrder.push('b:setup');
				expect(a).toBe('a');
				await use('b');
				executionOrder.push('b:teardown');
			},
			c: async (use, { b }) => {
				executionOrder.push('c:setup');
				expect(b).toBe('b');
				await use('c');
				executionOrder.push('c:teardown');
			},
			d: async (use, { b, c }) => {
				executionOrder.push('d:setup');
				expect(b).toBe('b');
				expect(c).toBe('c');
				await use('d');
				executionOrder.push('d:teardown');
			},
		});

		await f(async ({ d }) => {
			expect(d).toBe('d');
			expect(executionOrder).toEqual(['a:setup', 'b:setup', 'c:setup', 'd:setup']);
		})();

		expect(executionOrder).toEqual([
			'a:setup',
			'b:setup',
			'c:setup',
			'd:setup',
			'd:teardown',
			'c:teardown',
			'b:teardown',
			'a:teardown',
		]);
	});

	test('should detect circular dependencies', async () => {
		const f = fixtures<{
			x: string;
			y: string;
			z: string;
		}>({
			x: async (use, { z }) => {
				await use('x');
			},
			y: async (use, { x }) => {
				await use('y');
			},
			z: async (use, { y }) => {
				await use('z');
			},
		});

		expect(
			f(async ({ x }) => {
				// Should never get here
			})()
		).rejects.toThrow('Circular dependency');
	});

	test('should handle diamond dependencies', async () => {
		const executionOrder: string[] = [];

		const f = fixtures<{
			top: string;
			left: string;
			right: string;
			bottom: string;
		}>({
			top: async use => {
				executionOrder.push('top:setup');
				await use('top');
				executionOrder.push('top:teardown');
			},
			left: async (use, { top }) => {
				executionOrder.push('left:setup');
				await use('left');
				executionOrder.push('left:teardown');
			},
			right: async (use, { top }) => {
				executionOrder.push('right:setup');
				await use('right');
				executionOrder.push('right:teardown');
			},
			bottom: async (use, { left, right }) => {
				executionOrder.push('bottom:setup');
				await use('bottom');
				executionOrder.push('bottom:teardown');
			},
		});

		await f(async ({ bottom }) => {
			expect(executionOrder).toEqual(['top:setup', 'left:setup', 'right:setup', 'bottom:setup']);
		})();

		expect(executionOrder).toEqual([
			'top:setup',
			'left:setup',
			'right:setup',
			'bottom:setup',
			'bottom:teardown',
			'right:teardown',
			'left:teardown',
			'top:teardown',
		]);
	});

	test('should handle partial fixture usage', async () => {
		const executionOrder: string[] = [];

		const f = fixtures<{
			a: string;
			b: string;
			c: string;
		}>({
			a: async use => {
				executionOrder.push('a:setup');
				await use('a');
				executionOrder.push('a:teardown');
			},
			b: async (use, { a }) => {
				executionOrder.push('b:setup');
				await use('b');
				executionOrder.push('b:teardown');
			},
			c: async use => {
				executionOrder.push('c:setup');
				await use('c');
				executionOrder.push('c:teardown');
			},
		});

		// Only request 'c', should not set up 'a' or 'b'
		await f(async ({ c }) => {
			expect(executionOrder).toEqual(['c:setup']);
		})();

		expect(executionOrder).toEqual(['c:setup', 'c:teardown']);
	});

	test('should evaluate dependencies in correct order with timing', async () => {
		const executionTimes: { fixture: string; start: number; end: number }[] = [];
		const startTime = Date.now();

		const f = fixtures<{
			a: string;
			b: string;
			c: string;
		}>({
			a: async use => {
				const start = Date.now() - startTime;
				await Bun.sleep(20); // Simulate some async work
				executionTimes.push({ fixture: 'a', start, end: Date.now() - startTime });
				await use('a');
			},

			b: async (use, { a }) => {
				const start = Date.now() - startTime;
				await Bun.sleep(20); // Simulate some async work
				executionTimes.push({ fixture: 'b', start, end: Date.now() - startTime });
				await use('b');
			},

			c: async (use, { b }) => {
				const start = Date.now() - startTime;
				await Bun.sleep(20); // Simulate some async work
				executionTimes.push({ fixture: 'c', start, end: Date.now() - startTime });
				await use('c');
			},
		});

		await f(async ({ c }) => {
			// Verify that fixtures were evaluated in the correct order
			expect(executionTimes.length).toBe(3);

			// Check that a started first
			expect(executionTimes[0].fixture).toBe('a');

			// Check that b started after a ended
			expect(executionTimes[1].fixture).toBe('b');
			expect(executionTimes[1].start).toBeGreaterThanOrEqual(executionTimes[0].end);

			// Check that c started after b ended
			expect(executionTimes[2].fixture).toBe('c');
			expect(executionTimes[2].start).toBeGreaterThanOrEqual(executionTimes[1].end);

			// The total time should be roughly 60ms (3 x 20ms sleeps)
			const totalTime = executionTimes[2].end - executionTimes[0].start;
			expect(totalTime).toBeGreaterThanOrEqual(60);
			expect(totalTime).toBeLessThan(70); // Allow some wiggle room but not too much
		})();
	});

	test('should propagate setup errors and stop execution', async () => {
		const executionOrder: string[] = [];
		const setupError = new Error('Setup failed');

		const f = fixtures<{
			a: string;
			b: string;
		}>({
			a: async use => {
				executionOrder.push('a:setup');
				throw setupError;
			},
			b: async (use, { a }) => {
				executionOrder.push('b:setup');
				await use('b');
				executionOrder.push('b:teardown');
			},
		});

		let caughtError: Error | undefined;
		try {
			await f(async ({ b }) => {
				// Should never get here
				throw new Error('Test function should not execute');
			})();
		} catch (e) {
			caughtError = e as Error;
		}

		// Verify we caught the setup error
		expect(caughtError).toBe(setupError);
		// Should only have attempted to set up 'a'
		expect(executionOrder).toEqual(['a:setup']);
	});

	test('should attempt all teardowns even if some fail', async () => {
		const executionOrder: string[] = [];

		const f = fixtures<{
			a: 'my-value';
			b: 'my-value';
		}>({
			a: async use => {
				executionOrder.push('a:setup');
				await use('my-value');
				executionOrder.push('a:teardown-start');
				await Bun.sleep(50); // Longer delay to ensure error logging order
				throw new Error('Teardown A failed');
			},
			b: async (use, { a }) => {
				executionOrder.push('b:setup');
				await use(a);
				executionOrder.push('b:teardown-start');
			},
		});

		let testExecuted = false;
		let caughtError: Error | undefined;

		try {
			await f(async ({ b }) => {
				testExecuted = true;
				expect(executionOrder).toEqual(['a:setup', 'b:setup']);
			})();
		} catch (e) {
			caughtError = e as Error;
		}

		// Verify the test function executed
		expect(testExecuted).toBe(true);

		// Verify the execution order was correct up to the teardown
		expect(executionOrder).toEqual(['a:setup', 'b:setup', 'b:teardown-start', 'a:teardown-start']);

		// Verify we got the last teardown error
		expect(caughtError?.message).toBe('Fixture teardown failed');
		expect(caughtError).toBeInstanceOf(FixtureTeardownFailureError);
		expect((caughtError as FixtureTeardownFailureError).errors.length).toBe(1);
		expect((caughtError as FixtureTeardownFailureError).errors[0].message).toBe(
			'Teardown A failed'
		);
	});
});