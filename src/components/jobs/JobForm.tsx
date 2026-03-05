import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { DatePicker } from '../ui/DatePicker'
import type { Client, Contact } from '../../types'

interface JobFormData {
  clientId: string
  contactIds: string
  shootDates: string
  paymentTerms: string
  notes: string
  jobNumber: string
}

interface JobFormProps {
  data: JobFormData
  onChange: (data: JobFormData) => void
  clients: Client[]
  contacts: Contact[]
}

export function JobForm({ data, onChange, clients, contacts }: JobFormProps) {
  const clientContacts = contacts.filter((c) => c.clientId === data.clientId)
  const selectedContactIds = data.contactIds ? data.contactIds.split(',').filter(Boolean) : []

  // Parse shoot dates from comma-separated string to array
  const shootDateArray = data.shootDates ? data.shootDates.split(',').map((d) => d.trim()).filter(Boolean) : []

  const toggleContact = (contactId: string) => {
    const ids = selectedContactIds.includes(contactId)
      ? selectedContactIds.filter((id) => id !== contactId)
      : [...selectedContactIds, contactId]
    onChange({ ...data, contactIds: ids.join(',') })
  }

  return (
    <div className="space-y-4">
      <Input
        label="Job / Invoice Number"
        value={data.jobNumber}
        onChange={(e) => onChange({ ...data, jobNumber: e.target.value })}
        autoComplete="off"
      />
      <Select
        label="Client"
        value={data.clientId}
        options={[
          { value: '', label: 'Select a client...' },
          ...clients.filter((c) => c.company).map((c) => ({ value: c.id, label: c.company })),
        ]}
        onChange={(e) => {
          const newClientId = e.target.value
          const allContactIds = contacts.filter((c) => c.clientId === newClientId).map((c) => c.id).join(',')
          onChange({ ...data, clientId: newClientId, contactIds: allContactIds })
        }}
      />
      {clientContacts.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contacts</label>
          <div className="space-y-1">
            {clientContacts.map((contact) => (
              <label key={contact.id} className="flex items-center gap-2 min-h-[36px]">
                <input
                  type="checkbox"
                  checked={selectedContactIds.includes(contact.id)}
                  onChange={() => toggleContact(contact.id)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm">{contact.name} ({contact.email})</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <DatePicker
        label="Shoot Dates"
        selectedDates={shootDateArray}
        onChange={(dates) => onChange({ ...data, shootDates: dates.join(', ') })}
      />
      <Input
        label="Payment Terms"
        value={data.paymentTerms}
        onChange={(e) => onChange({ ...data, paymentTerms: e.target.value })}
        autoComplete="off"
      />
      <Input
        label="Notes"
        value={data.notes}
        onChange={(e) => onChange({ ...data, notes: e.target.value })}
        autoComplete="off"
      />
    </div>
  )
}
