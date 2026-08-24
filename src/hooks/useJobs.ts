import { useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDataContext } from '../context/DataProvider'
import { createJob as createJobApi, updateJob as updateJobApi, deleteJob as deleteJobApi } from '../services/api/jobs'
import type { Job, Settings } from '../types'

export function useJobs() {
  const { spreadsheetId, getToken } = useAuth()
  const { jobs, setJobs, setExpenses, jobsLoading: loading, reloadJobs, isRateLimited } = useDataContext()

  const createJob = useCallback(async (data: Partial<Job>, settings: Settings) => {
    if (!spreadsheetId) return
    if (isRateLimited) throw new Error('Rate limited — please wait')
    const token = await getToken()
    const job = await createJobApi(spreadsheetId, data, settings, jobs, token)
    setJobs((prev) => [...prev, job])
    return job
  }, [spreadsheetId, getToken, jobs, isRateLimited, setJobs])

  const updateJob = useCallback(async (job: Job) => {
    if (!spreadsheetId) return
    if (isRateLimited) throw new Error('Rate limited — please wait')
    const token = await getToken()
    await updateJobApi(spreadsheetId, job, token)
    setJobs((prev) => prev.map((j) => j.id === job.id ? job : j))
  }, [spreadsheetId, getToken, isRateLimited, setJobs])

  const deleteJob = useCallback(async (jobId: string) => {
    if (!spreadsheetId) return
    if (isRateLimited) throw new Error('Rate limited — please wait')
    const token = await getToken()
    await deleteJobApi(spreadsheetId, jobId, token)
    setJobs((prev) => prev.filter((j) => j.id !== jobId))
    // The job's expenses survive it, detached and unbilled — mirror that here
    // so they show up as available again without a reload.
    setExpenses((prev) => prev.map((e) => (
      e.jobId === jobId ? { ...e, jobId: '', billed: false } : e
    )))
  }, [spreadsheetId, getToken, isRateLimited, setJobs, setExpenses])

  return { jobs, loading, createJob, updateJob, deleteJob, reload: reloadJobs }
}
