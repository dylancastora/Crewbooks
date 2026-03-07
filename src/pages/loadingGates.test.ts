import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * These tests verify that the loading gates in DashboardPage and JobsPage
 * include expensesLoading, preventing job totals from rendering before
 * expense data has loaded.
 *
 * We test this structurally (by reading source) rather than rendering the
 * full components, because the components have deep dependency chains
 * (Google APIs, auth, etc.) that would require extensive mocking without
 * adding meaningful test value beyond "is expensesLoading in the gate?"
 */

function readSource(relativePath: string): string {
  return readFileSync(resolve(__dirname, '..', relativePath), 'utf-8')
}

describe('DashboardPage loading gate', () => {
  const source = readSource('pages/DashboardPage.tsx')

  it('imports useExpenses', () => {
    expect(source).toContain("import { useExpenses }")
  })

  it('destructures expensesLoading from useExpenses', () => {
    expect(source).toMatch(/loading:\s*expensesLoading.*useExpenses/)
  })

  it('includes expensesLoading in the combined loading condition', () => {
    // Extract the line that defines the combined loading variable
    const loadingLine = source.split('\n').find((line) =>
      line.includes('const loading =') && line.includes('||')
    )
    expect(loadingLine).toBeDefined()
    expect(loadingLine).toContain('expensesLoading')
  })

  it('shows spinner while loading', () => {
    expect(source).toContain('if (loading) return')
    expect(source).toContain('Spinner')
  })
})

describe('JobsPage loading gate', () => {
  const source = readSource('pages/JobsPage.tsx')

  it('imports useExpenses', () => {
    expect(source).toContain("import { useExpenses }")
  })

  it('destructures expensesLoading from useExpenses', () => {
    expect(source).toMatch(/loading:\s*expensesLoading.*useExpenses/)
  })

  it('includes expensesLoading in the combined loading condition', () => {
    const loadingLine = source.split('\n').find((line) =>
      line.includes('const loading =') && line.includes('||')
    )
    expect(loadingLine).toBeDefined()
    expect(loadingLine).toContain('expensesLoading')
  })

  it('shows spinner while loading', () => {
    expect(source).toContain('if (loading) return')
    expect(source).toContain('Spinner')
  })
})
