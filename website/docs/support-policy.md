---
sidebar_position: 3
---

# Support Policy

This page defines the supported contract for the current `0.3.x` stabilization line.

## Runtime Compatibility

- Node.js `>=22`
- NestJS `^11.0.0 || ^12.0.0`
- tRPC `11.x`

Both NestJS majors are tested claims. The default suite and samples run on 11; a dedicated CI leg (`nestjs-latest-major`) installs the NestJS 12 set on top of the lockfile, proves every workspace resolves 12, and runs the suite and every sample against it.

NestJS 12 notes:

- NestJS 12 is ESM-only and requires Node `>=20.19` / `>=22.12`; this package already requires Node `>=22`.
- NestJS 12 orders lifecycle hooks (`onModuleInit`, `onApplicationBootstrap`, and the shutdown hooks) by component hierarchy level rather than by registration order. This package does not assume any cross-provider hook order, and application code should not either.

## Supported Adapters

- Express
- Fastify

Your router classes and decorators should work the same across both adapters.

## Validation Support

- Zod `4.x` is supported and remains optional.
- `class-validator` + `ValidationPipe` DTO workflows are supported.
- Mixed validation strategies in the same application are supported.

## Supported Public API

The package has three support tiers. Keeping those tiers distinct prevents quick-start docs from accidentally turning testing helpers or internals into application APIs.

### Primary onboarding API

These are the APIs intended for installation docs, quick starts, and copy-paste usage:

- `TrpcModule.forRoot()` / `TrpcModule.forRootAsync()`
- `@Router()`
- `@Query()`
- `@Mutation()`
- `@Subscription()`
- `@Input()`
- `@TrpcContext()`
- generated `AppRouter` types via `autoSchemaFile`

### Advanced testing API

- `TrpcRouter` is supported for in-process testing via `getRouter().createCaller(...)`.

`TrpcRouter` should stay in testing-oriented guidance. It should not replace the normal application setup path based on `TrpcModule`, decorators, and generated `AppRouter` types.

### Low-level compatibility exports

These exports are public because they are part of the current top-level package entrypoint, but they are not onboarding APIs:

- `ProcedureType`
- `TrpcParamtype`

They are intended for compatibility with existing low-level metadata or test integrations. New application code should usually not need them. If future `0.x` work removes or replaces them, the project should document that migration separately instead of silently changing the package entrypoint.

## Unsupported Internal Surface

The following are implementation details and should not be treated as stable application APIs:

- deep imports into package internals such as `@nest-native/trpc/dist/...`
- internal context/runtime helpers
- raw schema generator helpers
- transport internals such as `TrpcHttpAdapter`
- metadata constants and DI tokens intended for package internals

These internals may change during `0.x` stabilization without being treated as a breaking change.

For a table view of the current exports and evidence behind public claims, see [Public API Reference](./reference/public-api) and [Claims Matrix](./reference/claims-matrix).
