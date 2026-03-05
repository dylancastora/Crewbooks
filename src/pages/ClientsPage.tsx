import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClients } from '../hooks/useClients'
import { useJobs } from '../hooks/useJobs'
import { useJobItems } from '../hooks/useJobItems'
import { useJobTotals } from '../hooks/useJobTotals'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { JobStatusBadge } from '../components/jobs/JobStatusBadge'
import { JobStatus } from '../types'
import type { Client, Contact } from '../types'

const emptyClient = { company: '', address: '', city: '', state: '', zip: '', notes: '' }
const emptyContact = { name: '', email: '', phone: '', role: '', clientId: '' }
const emptyNewContact = { name: '', email: '', phone: '', role: '' }

export function ClientsPage() {
  const navigate = useNavigate()
  const { clients, loading, createClient, updateClient, deleteClient, createContact, updateContact, deleteContact, getContactsForClient } = useClients()
  const { jobs } = useJobs()
  const { allItems } = useJobItems()
  const totalsMap = useJobTotals(allItems, jobs)
  const [showClientModal, setShowClientModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [clientForm, setClientForm] = useState(emptyClient)
  const [newContactForm, setNewContactForm] = useState(emptyNewContact)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [showContactModal, setShowContactModal] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [contactForm, setContactForm] = useState(emptyContact)
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const openNewClient = () => {
    setEditingClient(null)
    setClientForm(emptyClient)
    setNewContactForm(emptyNewContact)
    setShowClientModal(true)
  }

  const openEditClient = (client: Client) => {
    setEditingClient(client)
    setClientForm({ company: client.company, address: client.address, city: client.city, state: client.state, zip: client.zip, notes: client.notes })
    setShowClientModal(true)
  }

  const handleSaveClient = async () => {
    setSaving(true)
    try {
      if (editingClient) {
        await updateClient({ ...editingClient, ...clientForm })
      } else {
        const client = await createClient(clientForm)
        if (client) {
          await createContact({ ...newContactForm, clientId: client.id })
        }
      }
      setShowClientModal(false)
    } finally {
      setSaving(false)
    }
  }

  const openNewContact = (clientId: string) => {
    setEditingContact(null)
    setContactForm({ ...emptyContact, clientId })
    setShowContactModal(true)
  }

  const openEditContact = (contact: Contact) => {
    setEditingContact(contact)
    setContactForm({ name: contact.name, email: contact.email, phone: contact.phone, role: contact.role, clientId: contact.clientId })
    setShowContactModal(true)
  }

  const handleSaveContact = async () => {
    setSaving(true)
    try {
      if (editingContact) {
        await updateContact({ ...editingContact, ...contactForm })
      } else {
        await createContact(contactForm)
      }
      setShowContactModal(false)
    } finally {
      setSaving(false)
    }
  }

  const getClientJobs = (clientId: string) => {
    const clientJobs = jobs.filter((j) => j.clientId === clientId)
    const upcoming = clientJobs.filter((j) => {
      if (j.status === JobStatus.Paid) return false
      if (!j.shootDates) return true
      const dates = j.shootDates.split(',').map((d) => d.trim()).filter(Boolean)
      return dates.some((d) => d >= today)
    }).sort((a, b) => {
      const aDate = a.shootDates?.split(',')[0]?.trim() || ''
      const bDate = b.shootDates?.split(',')[0]?.trim() || ''
      return aDate.localeCompare(bDate)
    })
    const past = clientJobs.filter((j) => {
      if (j.status === JobStatus.Paid) return true
      if (!j.shootDates) return false
      const dates = j.shootDates.split(',').map((d) => d.trim()).filter(Boolean)
      return dates.every((d) => d < today)
    }).sort((a, b) => {
      const aDate = a.shootDates?.split(',').pop()?.trim() || ''
      const bDate = b.shootDates?.split(',').pop()?.trim() || ''
      return bDate.localeCompare(aDate)
    })
    return { upcoming, past }
  }

  // For new client modal: require company + contact name + contact email
  const canSaveNewClient = clientForm.company && newContactForm.name && newContactForm.email
  const canSaveEditClient = !!clientForm.company

  if (loading) return <Spinner className="py-12" />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Button onClick={openNewClient} size="sm">+ Add Client</Button>
      </div>

      {clients.length === 0 ? (
        <EmptyState message="No clients yet." actionLabel="Add Client" onAction={openNewClient} />
      ) : (
        <div className="space-y-3">
          {clients.map((client) => {
            const clientContacts = getContactsForClient(client.id)
            const isExpanded = expandedClient === client.id
            const { upcoming, past } = isExpanded ? getClientJobs(client.id) : { upcoming: [], past: [] }
            return (
              <Card key={client.id}>
                <div className="flex items-center justify-between" onClick={() => setExpandedClient(isExpanded ? null : client.id)}>
                  <div className="cursor-pointer flex-1">
                    <h3 className="font-semibold">{client.company}</h3>
                    <p className="text-sm text-gray-500">{[client.city, client.state].filter(Boolean).join(', ')}</p>
                  </div>
                  <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
                </div>
                {isExpanded && (
                  <div className="mt-4 border-t pt-4">
                    {client.address && <p className="text-sm text-gray-600 mb-1">{client.address}</p>}
                    {client.notes && <p className="text-sm text-gray-500 mb-3">{client.notes}</p>}
                    <div className="flex gap-2 mb-4">
                      <Button size="sm" variant="secondary" onClick={() => openEditClient(client)}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => deleteClient(client.id)}>Delete</Button>
                    </div>
                    <div className="border-t pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm">Contacts</h4>
                        <Button size="sm" variant="ghost" onClick={() => openNewContact(client.id)}>+ Add</Button>
                      </div>
                      {clientContacts.length === 0 ? (
                        <p className="text-sm text-gray-400">No contacts</p>
                      ) : (
                        <div className="space-y-2">
                          {clientContacts.map((contact) => (
                            <div key={contact.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                              <div>
                                <p className="text-sm font-medium">{contact.name}</p>
                                <p className="text-xs text-gray-500">{contact.email}{contact.role ? ` · ${contact.role}` : ''}</p>
                              </div>
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => openEditContact(contact)}>Edit</Button>
                                <Button size="sm" variant="ghost" onClick={() => deleteContact(contact.id)}>✕</Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {(upcoming.length > 0 || past.length > 0) && (
                      <div className="border-t pt-3 mt-3">
                        <h4 className="font-medium text-sm mb-2">Jobs</h4>
                        {upcoming.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs text-gray-500 uppercase mb-1">Upcoming</p>
                            {upcoming.map((job) => (
                              <div key={job.id} onClick={() => navigate(`/jobs/${job.id}`)} className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-gray-50 rounded px-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">#{job.jobNumber}</span>
                                  <JobStatusBadge status={job.status} />
                                </div>
                                <span className="text-sm font-semibold">${(totalsMap.get(job.id)?.total || 0).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {past.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase mb-1">Past</p>
                            {past.map((job) => (
                              <div key={job.id} onClick={() => navigate(`/jobs/${job.id}`)} className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-gray-50 rounded px-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">#{job.jobNumber}</span>
                                  <JobStatusBadge status={job.status} />
                                </div>
                                <span className="text-sm font-semibold">${(totalsMap.get(job.id)?.total || 0).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={showClientModal} onClose={() => setShowClientModal(false)} title={editingClient ? 'Edit Client' : 'New Client'}>
        <div className="space-y-3">
          <Input label="Company" value={clientForm.company} onChange={(e) => setClientForm({ ...clientForm, company: e.target.value })} autoComplete="off" />
          <Input label="Address" value={clientForm.address} onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })} autoComplete="off" />
          <div className="grid grid-cols-3 gap-2">
            <Input label="City" value={clientForm.city} onChange={(e) => setClientForm({ ...clientForm, city: e.target.value })} autoComplete="off" />
            <Input label="State" value={clientForm.state} onChange={(e) => setClientForm({ ...clientForm, state: e.target.value })} autoComplete="off" />
            <Input label="ZIP" value={clientForm.zip} onChange={(e) => setClientForm({ ...clientForm, zip: e.target.value })} autoComplete="off" />
          </div>
          <Input label="Notes" value={clientForm.notes} onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })} autoComplete="off" />

          {!editingClient && (
            <>
              <div className="border-t pt-3 mt-3">
                <h4 className="font-medium text-sm mb-2">Primary Contact</h4>
                <div className="space-y-3">
                  <Input label="Contact Name" value={newContactForm.name} onChange={(e) => setNewContactForm({ ...newContactForm, name: e.target.value })} autoComplete="off" />
                  <Input label="Contact Email" type="email" value={newContactForm.email} onChange={(e) => setNewContactForm({ ...newContactForm, email: e.target.value })} autoComplete="off" />
                  <Input label="Contact Phone" type="tel" value={newContactForm.phone} onChange={(e) => setNewContactForm({ ...newContactForm, phone: e.target.value })} autoComplete="off" />
                  <Input label="Role" value={newContactForm.role} onChange={(e) => setNewContactForm({ ...newContactForm, role: e.target.value })} autoComplete="off" />
                </div>
              </div>
            </>
          )}

          <Button
            onClick={handleSaveClient}
            disabled={saving || (editingClient ? !canSaveEditClient : !canSaveNewClient)}
            className="w-full"
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </Modal>

      <Modal open={showContactModal} onClose={() => setShowContactModal(false)} title={editingContact ? 'Edit Contact' : 'New Contact'}>
        <div className="space-y-3">
          <Input label="Name" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} autoComplete="off" />
          <Input label="Email" type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} autoComplete="off" />
          <Input label="Phone" type="tel" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} autoComplete="off" />
          <Input label="Role" value={contactForm.role} onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })} autoComplete="off" />
          <Button onClick={handleSaveContact} disabled={saving || !contactForm.name} className="w-full">
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
