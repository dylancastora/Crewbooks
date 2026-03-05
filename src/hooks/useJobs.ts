import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { getJobs, createJob as createJobApi, updateJob as updateJobApi, deleteJob as deleteJobApi } from '../services/api/jobs'
import type { Job, Settings } from '../types'

export function useJobs() {
  const { spreadsheetId, getToken } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!spreadsheetId) return
    setLoading(true)
    try {
      const token = await getToken()
      const data = await getJobs(spreadsheetId, token)
      setJobs(data)
    } finally {
      setLoading(false)
    }
  }, [spreadsheetId, getToken])

  useEffect(() => { load() }, [load])

  const createJob = useCallback(async (data: Partial<Job>, settings: Settings) => {
    if (!spreadsheetId) return
    const token = await getToken()
    const job = await createJobApi(spreadsheetId, data, settings, jobs, token)
    setJobs((prev) => [...prev, job])
    return job
  }, [spreadsheetId, getToken, jobs])

  const updateJob = useCallback(async (job: Job) => {
    if (!spreadsheetId) return
    const token = await getToken()
    await updateJobApi(spreadsheetId, job, token)
    setJobs((prev) => prev.map((j) => j.id === job.id ? job : j))
  }, [spreadsheetId, getToken])

  const deleteJob = useCallback(async (jobId: string) => {
    if (!spreadsheetId) return
    const token = await getToken()
    await deleteJobApi(spreadsheetId, jobId, token)
    setJobs((prev) => prev.filter((j) => j.id !== jobId))
  }, [spreadsheetId, getToken])

  return { jobs, loading, createJob, updateJob, deleteJob, reload: load }
}
