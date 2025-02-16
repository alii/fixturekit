# fixturekit

A powerful and flexible test fixture management system for TypeScript/JavaScript that handles setup, teardown, and dependencies between fixtures with type safety.

## Features

- 🔄 Automatic fixture setup and teardown
- 📦 Dependency management between fixtures
- 🔍 Type-safe fixture access
- 🎯 Selective fixture initialization
- 🚫 Circular dependency detection

## Installation

```bash
bun add fixturekit
# or
npm install fixturekit
# or
yarn add fixturekit
# or
pnpm add fixturekit
```

## Usage

### Basic Example with Bun

```typescript
import { expect, test } from 'bun:test';
import { fixtures } from 'fixturekit';

// Define your test fixtures with types
const f = fixtures<{
	counter: { value: number };
	server_url: string;
}>({
	counter: async use => {
		// Setup initial state
		const counter = { value: 0 };
		await use(counter);
		// Cleanup/reset after test
		counter.value = 0;
	},

	server_url: async use => {
		// Setup
		const server = Bun.serve({
			port: 3000,
			fetch: () => new Response('OK'),
		});

		await use(server.url.toString());

		// Cleanup
		await server.stop();
	},
});

// Use fixtures in your tests as a higher-order function
test(
	'counter should increment',
	f(async ({ counter }) => {
		counter.value++;
		expect(counter.value).toBe(1);
	})
);

test(
	'server should respond',
	f(async ({ server_url }) => {
		const res = await fetch(server_url);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe('OK');
	})
);

test(
	'state resets between tests',
	f(async ({ counter }) => {
		expect(counter.value).toBe(0); // Fresh state each time
	})
);
```

### Real-World Example

Here's a more comprehensive example showing how to manage a test server, state, and dependencies:

```typescript
import { expect, test } from 'bun:test';
import { fixtures } from 'fixturekit';

// Define a simple store for counting
const countStore = {
	store: 0,
};

// Define your fixtures with TypeScript types
const testFixtures = fixtures<{
	count: typeof countStore;
	server_url: string;
	server_url_wrapper: string;
}>({
	// Fixture for managing count state
	count: async use => {
		await use(countStore);
		// Reset count after each test
		countStore.store = 0;
	},

	// Fixture for managing a test server
	server_url: async use => {
		console.log('Starting server');

		const server = Bun.serve({
			port: 3000,
			fetch: async () => {
				await Bun.sleep(100); // Simulate processing time
				return new Response('Hello World');
			},
		});

		// Provide the server URL to the test
		await use(server.url.toString());

		// Cleanup: stop the server
		await server.stop(true);
		await Bun.sleep(100); // Wait for server to fully stop
		console.log('Server stopped');
	},

	// Example of a fixture that depends on another fixture
	server_url_wrapper: async (use, { server_url }) => {
		await use(server_url);
	},
});

// Test 1: Using multiple fixtures
test(
	'should handle counter and server',
	testFixtures(async ({ count, server_url }) => {
		// Test counter
		count.store++;
		expect(count.store).toBe(1);

		// Test server
		expect(server_url).toBe('http://localhost:3000/');
		const response = await fetch(server_url);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe('Hello World');
	})
);

// Test 2: Demonstrating state reset between tests
test(
	'should have fresh count state',
	testFixtures(async ({ count }) => {
		expect(count.store).toBe(0); // Count is reset
		count.store++;
		expect(count.store).toBe(1);
	})
);

// Test 3: Using wrapped fixture
test(
	'should work with fixture dependencies',
	testFixtures(async ({ server_url_wrapper }) => {
		const response = await fetch(server_url_wrapper);
		expect(response.status).toBe(200);
	})
);
```

### Important Rules

1. **Destructuring is Required**: You must use object destructuring syntax to access fixtures in your test functions:

   ```typescript
   // ✅ Correct
   myFixtures(async ({ database, user }) => {});

   // ❌ Wrong
   myFixtures(async fixtures => {});
   ```

2. **`use` Function Parameter Name**: The first parameter of your fixture getter must be named exactly `use`:

   ```typescript
   // ✅ Correct
   fixtures({
   	myFixture: async use => {
   		await use(value);
   	},
   });

   // ❌ Wrong
   fixtures({
   	myFixture: async setValue => {
   		await setValue(value);
   	},
   });
   ```

### Fixture Dependencies

Fixtures can depend on other fixtures. Dependencies are automatically detected and managed. All fixtures are executed sequentially in dependency order - even if some fixtures could theoretically run in parallel, they will be executed one after another for predictable behavior:

```typescript
const testFixtures = fixtures({
	config: async use => {
		await use({ apiUrl: 'http://api.example.com' });
	},

	api: async (use, { config }) => {
		const client = new ApiClient(config.apiUrl);
		await use(client);
		await client.disconnect();
	},

	user: async (use, { api }) => {
		const user = await api.createUser();
		await use(user);
		await api.deleteUser(user.id);
	},
});
```

For example, in a diamond dependency pattern where both `left` and `right` depend on `top`, and `bottom` depends on both `left` and `right`, the execution will be strictly sequential: `top` → `left` → `right` → `bottom`.

### Async Setup and Teardown

Each fixture can perform async setup and teardown operations:

```typescript
fixtures({
	server: async use => {
		// Setup
		const server = await startServer();

		// Use the fixture
		await use(server);

		// Teardown
		await server.stop();
	},
});
```

### Type Safety

FixtureKit is fully typed and provides excellent TypeScript support:

```typescript
interface MyFixtures {
	database: Database;
	user: User;
	config: Config;
}

const myFixtures = fixtures<MyFixtures>({
	// TypeScript will ensure all fixtures match the interface
	database: async use => {
		// ...
	},
	// ...
});
```

## API Reference

### `fixtures<T>(getters)`

Creates a fixture management system.

- `T`: Type describing the shape of your fixtures
- `getters`: Object containing fixture getter functions

Returns a function that wraps test functions with fixture handling.

### Fixture Getter Function

Each fixture is defined by a getter function with the signature:

```typescript
async (use: (value: T) => Promise<void>, deps: Dependencies) => void
```

- `use`: Function to set the fixture value
- `deps`: Object containing dependent fixtures

## Best Practices

1. **Cleanup After Use**: Always clean up resources in fixtures after `use()`:

   ```typescript
   async use => {
   	const resource = await createResource();
   	await use(resource);
   	await cleanup(resource); // Important!
   };
   ```

2. **Keep Fixtures Focused**: Each fixture should handle one specific resource or piece of state.

3. **Handle Errors**: Use try/finally to ensure cleanup runs even if there are errors:
   ```typescript
   async use => {
   	const resource = await createResource();
   	try {
   		await use(resource);
   	} finally {
   		await cleanup(resource);
   	}
   };
   ```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
