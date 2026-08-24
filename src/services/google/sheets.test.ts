import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { deleteRowById, updateRowById, queueTabWrite } from './sheets'

const SHEET = 'sheet-1'
const TOKEN = 'token'

/**
 * A tiny in-memory stand-in for one Sheets tab. Reads return the current rows;
 * deletes and writes act on a row *index*, which is exactly what makes
 * concurrent callers dangerous — an index resolved before someone else's delete
 * points at the wrong row afterwards.
 */
function mockSheet(rows: string[][]) {
  const values = [['id', 'value'], ...rows]

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method || 'GET'

    if (method === 'GET' && url.includes('/values/')) {
      return jsonResponse({ values })
    }
    if (url.includes('?fields=sheets.properties')) {
      return jsonResponse({ sheets: [{ properties: { title: 'Expenses', sheetId: 0 } }] })
    }
    if (url.includes(':batchUpdate')) {
      const body = JSON.parse(String(init?.body))
      for (const request of body.requests) {
        const { startIndex, endIndex } = request.deleteDimension.range
        values.splice(startIndex, endIndex - startIndex)
      }
      return jsonResponse({})
    }
    if (method === 'PUT') {
      const rowNumber = parseInt(decodeURIComponent(url).match(/!A(\d+)/)![1], 10)
      values[rowNumber - 1] = JSON.parse(String(init?.body)).values[0]
      return jsonResponse({})
    }
    throw new Error(`unexpected request: ${method} ${url}`)
  })

  return { values, fetchMock }
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    json: async () => body,
  } as Response
}

describe('sheets write serialization', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('deletes only the requested rows when deletes are fired concurrently', async () => {
    const { values, fetchMock } = mockSheet([['a', '1'], ['b', '2'], ['c', '3'], ['d', '4']])
    vi.stubGlobal('fetch', fetchMock)

    // Rapid-fire removal: both calls start before either finishes.
    await Promise.all([
      deleteRowById(SHEET, 'Expenses', 'b', TOKEN),
      deleteRowById(SHEET, 'Expenses', 'c', TOKEN),
    ])

    expect(values.slice(1).map((r) => r[0])).toEqual(['a', 'd'])
  })

  it('leaves the sheet intact when a delete races an update', async () => {
    const { values, fetchMock } = mockSheet([['a', '1'], ['b', '2'], ['c', '3']])
    vi.stubGlobal('fetch', fetchMock)

    await Promise.all([
      deleteRowById(SHEET, 'Expenses', 'a', TOKEN),
      updateRowById(SHEET, 'Expenses', 'c', ['c', 'updated'], TOKEN),
    ])

    expect(values.slice(1)).toEqual([['b', '2'], ['c', 'updated']])
  })

  it('is a no-op when the row is already gone', async () => {
    const { values, fetchMock } = mockSheet([['a', '1']])
    vi.stubGlobal('fetch', fetchMock)

    await Promise.all([
      deleteRowById(SHEET, 'Expenses', 'a', TOKEN),
      deleteRowById(SHEET, 'Expenses', 'a', TOKEN),
    ])

    expect(values.slice(1)).toEqual([])
  })

  it('runs queued writes one at a time, in order', async () => {
    const events: string[] = []
    const op = (name: string) => async () => {
      events.push(`${name}:start`)
      await new Promise((resolve) => setTimeout(resolve, name === 'first' ? 20 : 0))
      events.push(`${name}:end`)
    }

    await Promise.all([
      queueTabWrite(SHEET, 'Jobs', op('first')),
      queueTabWrite(SHEET, 'Jobs', op('second')),
    ])

    expect(events).toEqual(['first:start', 'first:end', 'second:start', 'second:end'])
  })

  it('keeps draining the queue after a write fails', async () => {
    const events: string[] = []

    const failing = queueTabWrite(SHEET, 'Clients', async () => {
      events.push('failed')
      throw new Error('boom')
    })
    const next = queueTabWrite(SHEET, 'Clients', async () => { events.push('ran') })

    await expect(failing).rejects.toThrow('boom')
    await next
    expect(events).toEqual(['failed', 'ran'])
  })

  it('does not serialize writes to unrelated tabs', async () => {
    const events: string[] = []

    await Promise.all([
      queueTabWrite(SHEET, 'Jobs', async () => {
        events.push('jobs:start')
        await new Promise((resolve) => setTimeout(resolve, 10))
        events.push('jobs:end')
      }),
      queueTabWrite(SHEET, 'Expenses', async () => { events.push('expenses:start') }),
    ])

    expect(events.indexOf('expenses:start')).toBeLessThan(events.indexOf('jobs:end'))
  })
})
