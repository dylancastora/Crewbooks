export function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>

      <div className="space-y-4 text-gray-700">
        <p><strong>Last updated:</strong> {new Date().toISOString().split('T')[0]}</p>

        <h2 className="text-lg font-semibold mt-6">What data we access</h2>
        <p>
          CrewBooks accesses your Google account solely to provide the application's core features.
          We request the following permissions:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Google Sheets:</strong> To read and write your invoicing data in a spreadsheet you own</li>
          <li><strong>Google Drive:</strong> To create folders and store receipt images in your Drive</li>
          <li><strong>Gmail:</strong> To send quotes and invoices on your behalf</li>
          <li><strong>Profile info:</strong> To display your name and email in the app</li>
        </ul>

        <h2 className="text-lg font-semibold mt-6">Where your data is stored</h2>
        <p>
          All your data (clients, rates, jobs, invoices) is stored exclusively in your own Google Drive
          as a Google Sheets spreadsheet. Receipt images are stored in your own Google Drive.
          CrewBooks has no backend server and does not store any of your data on external servers.
        </p>

        <h2 className="text-lg font-semibold mt-6">Authentication</h2>
        <p>
          Your Google access token is held in memory only for the duration of your browser session.
          It is never written to localStorage, cookies, or any persistent storage.
          When you close the app or sign out, the token is discarded.
        </p>

        <h2 className="text-lg font-semibold mt-6">Third parties</h2>
        <p>
          CrewBooks does not share, sell, or transmit your data to any third party.
          All communication is directly between your browser and Google's APIs.
        </p>

        <h2 className="text-lg font-semibold mt-6">Data deletion</h2>
        <p>
          To remove all CrewBooks data, simply delete the "CrewBooks" folder and
          "CrewBooks Database" spreadsheet from your Google Drive. You can also revoke
          the app's access in your Google Account settings under "Third-party apps with account access."
        </p>

        <h2 className="text-lg font-semibold mt-6">Contact</h2>
        <p>
          If you have questions about this privacy policy, please contact the app developer.
        </p>
      </div>
    </div>
  )
}
