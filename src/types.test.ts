/**
 * Portal Types Tests
 *
 * Compile-time type validation tests.
 * If these compile, the types are correct.
 */

import { describe, expect, test } from 'bun:test'
import type {
  MethodNames,
  ParamsOf,
  ResultOf,
  MergeSchemas,
  MethodHandler,
  MethodHandlers,
} from './types'

// =============================================================================
// Type-Level Tests (compile-time validation)
// =============================================================================

// Test schema
type TestSchema = {
  greet: { params: [name: string]; result: string }
  add: { params: [a: number, b: number]; result: number }
  noParams: { params: []; result: void }
}

// MethodNames extracts string keys
type _TestMethodNames = MethodNames<TestSchema>
const _methodName: _TestMethodNames = 'greet' // Should compile
// @ts-expect-error - 'invalid' is not a method name
const _invalidMethod: _TestMethodNames = 'invalid'

// ParamsOf extracts params tuple
type _GreetParams = ParamsOf<TestSchema, 'greet'>
const _greetParams: _GreetParams = ['World'] // Should compile
// @ts-expect-error - number is not string
const _invalidGreetParams: _GreetParams = [123]

type _AddParams = ParamsOf<TestSchema, 'add'>
const _addParams: _AddParams = [1, 2] // Should compile
// @ts-expect-error - missing second param
const _invalidAddParams: _AddParams = [1]

// ResultOf extracts result type
type _GreetResult = ResultOf<TestSchema, 'greet'>
const _greetResult: _GreetResult = 'Hello' // Should compile
// @ts-expect-error - number is not string
const _invalidGreetResult: _GreetResult = 123

type _AddResult = ResultOf<TestSchema, 'add'>
const _addResult: _AddResult = 42 // Should compile
// @ts-expect-error - string is not number
const _invalidAddResult: _AddResult = '42'

// MergeSchemas combines two schemas
type ExtensionSchema = {
  custom: { params: [data: object]; result: boolean }
}

type MergedSchema = MergeSchemas<TestSchema, ExtensionSchema>
type _MergedMethods = MethodNames<MergedSchema>
const _hasGreet: _MergedMethods = 'greet' // Should compile
const _hasCustom: _MergedMethods = 'custom' // Should compile

// MethodHandler has correct types
const _greetHandler: MethodHandler<[string], string> = ([name]) => `Hi ${name}`
// @ts-expect-error - wrong return type
const _invalidHandler: MethodHandler<[string], string> = ([_name]) => 123

// MethodHandlers must implement all methods
const _handlers: MethodHandlers<TestSchema> = {
  greet: ([name]) => `Hello ${name}`,
  add: ([a, b]) => a + b,
  noParams: () => {},
}

// @ts-expect-error - missing 'add' handler
const _incompleteHandlers: MethodHandlers<TestSchema> = {
  greet: ([name]) => `Hello ${name}`,
  noParams: () => {},
}

// PortalRequest has correct structure
const _request: PortalRequest<TestSchema, 'greet'> = {
  type: 'request',
  id: 1,
  method: 'greet',
  params: ['World'],
}

// @ts-expect-error - wrong params type
const _invalidRequest: PortalRequest<TestSchema, 'greet'> = {
  type: 'request',
  id: 1,
  method: 'greet',
  params: [123],
}

// =============================================================================
// Runtime Tests (ensure types work at runtime)
// =============================================================================

describe('Type Tests', () => {
  test('schemas are structurally correct', () => {
    // These are compile-time tests, but we run them to ensure no runtime issues
    expect(true).toBe(true)
  })

  test('handler types match schema', () => {
    const handlers: MethodHandlers<TestSchema> = {
      greet: ([name]) => {
        // TypeScript knows name is string
        return name.toUpperCase()
      },
      add: ([a, b]) => {
        // TypeScript knows a and b are numbers
        return a + b
      },
      noParams: () => {
        // TypeScript knows no params
        return undefined
      },
    }

    expect(handlers.greet(['test'], { id: 1 })).toBe('TEST')
    expect(handlers.add([2, 3], { id: 2 })).toBe(5)
    expect(handlers.noParams([], { id: 3 })).toBe(undefined)
  })

  test('merged schemas include all methods', () => {
    type Base = { a: { params: []; result: string } }
    type Extension = { b: { params: []; result: number } }
    type Merged = MergeSchemas<Base, Extension>

    const handlers: MethodHandlers<Merged> = {
      a: () => 'a',
      b: () => 1,
    }

    expect(handlers.a([], { id: 1 })).toBe('a')
    expect(handlers.b([], { id: 2 })).toBe(1)
  })
})
