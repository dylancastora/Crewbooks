import { describe, it, expect } from 'vitest'
import { generateJobNumber } from './jobs'
import type { Job, Settings } from '../../types'

function makeJob(jobNumber: string): Job {
  return {
    id: crypto.randomUUID(),
    jobNumber,
    clientId: '',
    title: '',
    status: 'draft',
    contactIds: '',
    shootDates: '',
    taxRate: 0,
    paymentTerms: '',
    notes: '',
    cancelled: false,
    createdAt: '',
    updatedAt: '',
  }
}

describe('generateJobNumber', () => {
  it('returns "0001" when no existing jobs and no custom start number', () => {
    const result = generateJobNumber([], {})
    expect(result).toBe('0001')
  })

  it('respects invoiceStartNumber setting when no existing jobs', () => {
    const settings: Settings = { invoiceStartNumber: '100' }
    const result = generateJobNumber([], settings)
    expect(result).toBe('0100')
  })

  it('returns max job number + 1 from existing jobs', () => {
    const jobs = [makeJob('0003'), makeJob('0007'), makeJob('0005')]
    const result = generateJobNumber(jobs, {})
    expect(result).toBe('0008')
  })

  it('uses invoiceStartNumber as floor when existing jobs are below it', () => {
    const jobs = [makeJob('0002')]
    const settings: Settings = { invoiceStartNumber: '100' }
    const result = generateJobNumber(jobs, settings)
    expect(result).toBe('0100')
  })

  it('ignores invoiceStartNumber when existing jobs exceed it', () => {
    const jobs = [makeJob('0150')]
    const settings: Settings = { invoiceStartNumber: '100' }
    const result = generateJobNumber(jobs, settings)
    expect(result).toBe('0151')
  })

  it('handles non-numeric job numbers gracefully', () => {
    const jobs = [makeJob('abc'), makeJob('0010')]
    const result = generateJobNumber(jobs, {})
    expect(result).toBe('0011')
  })

  it('pads result to 4 digits', () => {
    const jobs = [makeJob('0001')]
    const result = generateJobNumber(jobs, {})
    expect(result).toBe('0002')
  })

  // KEY TEST: This is the bug scenario — calling with empty jobs array
  // should return start number, NOT always 0001
  it('returns correct number with empty jobs array but custom start number', () => {
    const settings: Settings = { invoiceStartNumber: '500' }
    const result = generateJobNumber([], settings)
    expect(result).toBe('0500')
  })
})
