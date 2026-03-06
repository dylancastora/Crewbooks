import { useState } from 'react'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { DatePicker } from '../ui/DatePicker'
import { Button } from '../ui/Button'
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
  createClient?: (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Client | undefined>
  createContact?: (data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Contact | undefined>
}

export function JobForm({ data, onChange, clients, contacts, createClient, createContact }: JobFormProps) {
  const clientContacts = contacts.filter((c) => c.clientId === data.clientId)
  const selectedContactIds = data.contactIds ? data.contactIds.split(',').filter(Boolean) : []

  // Parse shoot dates from comma-separated string to array
  const shootDateArray = data.shootDates ? data.shootDates.split(',').map((d) => d.trim()).filter(Boolean) : []

  const [showNewClient, setShowNewClient] = useState(false)
  const [newClientForm, setNewClientForm] = useState({
    company: '', address: '', city: '', state: '', zip: '', notes: '',
    contactName: '', contactEmail: '', contactPhone: '', contactRole: '',
  })
  const [savingClient, setSavingClient] = useState(false)

  const toggleContact = (contactId: string) => {
    const ids = selectedContactIds.includes(contactId)
      ? selectedContactIds.filter((id) => id !== contactId)
      : [...selectedContactIds, contactId]
    onChange({ ...data, contactIds: ids.join(',') })
  }

  const handleClientChange = (value: string) => {
    if (value === '__new__') {
      setShowNewClient(true)
      return
    }
    const allContactIds = contacts.filter((c) => c.clientId === value).map((c) => c.id).join(',')
    onChange({ ...data, clientId: value, contactIds: allContactIds })
  }

  const handleSaveNewClient = async () => {
    if (!createClient || !createContact) return
    setSavingClient(true)
    try {
      const client = await createClient({
        company: newClientForm.company,
        address: newClientForm.address,
        city: newClientForm.city,
        state: newClientForm.state,
        zip: newClientForm.zip,
        notes: newClientForm.notes,
      })
      if (!client) return

      let contactId = ''
      if (newClientForm.contactName) {
        const contact = await createContact({
          clientId: client.id,
          name: newClientForm.contactName,
          email: newClientForm.contactEmail,
          phone: newClientForm.contactPhone,
          role: newClientForm.contactRole,
        })
        if (contact) contactId = contact.id
      }

      onChange({ ...data, clientId: client.id, contactIds: contactId })
      setShowNewClient(false)
      setNewClientForm({ company: '', address: '', city: '', state: '', zip: '', notes: '', contactName: '', contactEmail: '', contactPhone: '', contactRole: '' })
    } finally {
      setSavingClient(false)
    }
  }

  const handleCancelNewClient = () => {
    setShowNewClient(false)
    setNewClientForm({ company: '', address: '', city: '', state: '', zip: '', notes: '', contactName: '', contactEmail: '', contactPhone: '', contactRole: '' })
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
        value={showNewClient ? '__new__' : data.clientId}
        options={[
          { value: '', label: 'Select a client...' },
          ...clients.filter((c) => c.company).map((c) => ({ value: c.id, label: c.company })),
          ...(createClient ? [{ value: '__new__', label: '+ Add New Client' }] : []),
        ]}
        onChange={(e) => handleClientChange(e.target.value)}
      />
      {showNewClient && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <h4 className="font-medium text-sm text-gray-700">New Client</h4>
          <Input label="Company" value={newClientForm.company} onChange={(e) => setNewClientForm({ ...newClientForm, company: e.target.value })} autoComplete="off" />
          <Input label="Address" value={newClientForm.address} onChange={(e) => setNewClientForm({ ...newClientForm, address: e.target.value })} autoComplete="off" />
          <div className="grid grid-cols-3 gap-2">
            <Input label="City" value={newClientForm.city} onChange={(e) => setNewClientForm({ ...newClientForm, city: e.target.value })} autoComplete="off" />
            <Input label="State" value={newClientForm.state} onChange={(e) => setNewClientForm({ ...newClientForm, state: e.target.value })} autoComplete="off" />
            <Input label="ZIP" value={newClientForm.zip} onChange={(e) => setNewClientForm({ ...newClientForm, zip: e.target.value })} autoComplete="off" />
          </div>
          <Input label="Notes" value={newClientForm.notes} onChange={(e) => setNewClientForm({ ...newClientForm, notes: e.target.value })} autoComplete="off" />
          <h4 className="font-medium text-sm text-gray-700 pt-2">Primary Contact</h4>
          <Input label="Name" value={newClientForm.contactName} onChange={(e) => setNewClientForm({ ...newClientForm, contactName: e.target.value })} autoComplete="off" />
          <Input label="Email" value={newClientForm.contactEmail} onChange={(e) => setNewClientForm({ ...newClientForm, contactEmail: e.target.value })} autoComplete="off" />
          <Input label="Phone" value={newClientForm.contactPhone} onChange={(e) => setNewClientForm({ ...newClientForm, contactPhone: e.target.value })} autoComplete="off" />
          <Input label="Role" value={newClientForm.contactRole} onChange={(e) => setNewClientForm({ ...newClientForm, contactRole: e.target.value })} autoComplete="off" />
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSaveNewClient} disabled={!newClientForm.company || savingClient}>
              {savingClient ? 'Saving...' : 'Save Client'}
            </Button>
            <Button variant="secondary" onClick={handleCancelNewClient}>Cancel</Button>
          </div>
        </div>
      )}
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
