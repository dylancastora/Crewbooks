import { Spinner } from './Spinner'
import { useDataContext } from '../../context/DataProvider'

export function LoadingScreen() {
  const { conforming } = useDataContext()
  return <Spinner className="py-12" message={conforming ? 'Updating your database — this may take up to 30 seconds. Please don\'t close this tab.' : 'Loading data...'} />
}
