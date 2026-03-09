import { useCallback } from 'react'
import { useDataContext } from '../context/DataProvider'

export function useJobItems() {
  const { allItems, itemsLoading: loading, reloadItems } = useDataContext()

  const getItemsForJob = useCallback((jobId: string) => {
    return allItems.filter((item) => item.jobId === jobId)
  }, [allItems])

  return { allItems, getItemsForJob, loading, reload: reloadItems }
}
