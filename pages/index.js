import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function CurrencyConverterNetworkDashboard() {
  const [error, setError] = useState(null);
  const [makeOfferModal, setMakeOfferModal] = useState({ open: false, request: null });
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', amount: '' });
  const [requestForm, setRequestForm] = useState({
    name: '',
    email: '',
    phone: '',
    needCurrency: '',
    haveCurrency: '',
    haveAmount: '',
  });
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/requests');
      if (!response.ok) throw new Error('Failed to fetch requests');
      const data = await response.json();
      const sorted = Array.isArray(data)
        ? data
            .filter((request) => request.status !== 'closed')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        : [];
      setRequests(sorted);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching requests:', err);
    } finally {
      setRequestsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    const interval = setInterval(fetchRequests, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatAmount = (value) => {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric.toLocaleString() : '—';
  };

  const currencyOptions = [
    'KES - Kenyan Shilling',
    'ZAR - South African Rand',
    'NGN - Nigerian Naira',
    'UGX - Ugandan Shilling',
    'GHS - Ghanaian Cedi',
    'USD - US Dollar',
    'EUR - Euro',
  ];

  // Format time ago
  const getTimeAgo = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  // Open make offer modal
  const openMakeOfferModal = (request) => {
    setMakeOfferModal({ open: true, request });
    setFormData({ name: '', email: '', phone: '', amount: '' });
  };

  // Close make offer modal
  const closeMakeOfferModal = () => {
    setMakeOfferModal({ open: false, request: null });
    setFormData({ name: '', email: '', phone: '', amount: '' });
  };

  const resetRequestForm = () => {
    setRequestForm({
      name: '',
      email: '',
      phone: '',
      needCurrency: '',
      haveCurrency: '',
      haveAmount: '',
    });
  };

  const openRequestModal = () => {
    setRequestModalOpen(true);
  };

  const closeRequestModal = () => {
    setRequestModalOpen(false);
  };

  // Handle make offer submission
  const handleMakeOffer = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const offerAmount = Number(formData.amount);

      const response = await fetch(`/api/requests/${makeOfferModal.request.requestId}/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responder: {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
          },
          offerAmount,
          needCurrency: makeOfferModal.request.needCurrency,
          haveCurrency: makeOfferModal.request.haveCurrency,
        }),
      });

      if (!response.ok) throw new Error('Failed to send offer');

      setSuccessMessage('Offer submitted!');
      closeMakeOfferModal();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    setRequestSubmitting(true);
    setError(null);

    const email = requestForm.email.trim();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValid) {
      setError('Please enter a valid email address.');
      setRequestSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: requestForm.name.trim(),
          email,
          phone: requestForm.phone.trim(),
          needCurrency: requestForm.needCurrency,
          haveCurrency: requestForm.haveCurrency,
          haveAmount: Number(requestForm.haveAmount),
        }),
      });

      if (!response.ok) {
        let message = 'Failed to submit request';
        try {
          const data = await response.json();
          if (data?.error) message = data.error;
          if (data?.details) message = `${message}: ${data.details}`;
        } catch (_) {
          try {
            const text = await response.text();
            if (text) message = text;
          } catch (_) {
            // ignore
          }
        }
        throw new Error(message);
      }

      setSuccessMessage('Request submitted!');
      resetRequestForm();
      closeRequestModal();
      fetchRequests();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setRequestSubmitting(false);
    }
  };



  return (
    <>
      <Head>
        <title>CurrencyConverterNetwork - Currency Exchange Dashboard</title>
        <meta name="description" content="Peer-to-peer currency exchange platform" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-purple-800">
        {/* Success Message Toast */}
        {successMessage && (
          <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-fade-in">
            {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg">
            Error: {error}
          </div>
        )}

        {/* Header */}
        <header className="bg-white/10 backdrop-blur-md border-b border-white/20 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/70">
                  Currency Exchange Network
                </div>
                <p className="text-white/80 text-sm mt-1">Connect with verified exchangers and compare offers fast.</p>
              </div>
              <div className="text-right">
                <div className="text-white text-2xl font-bold">{requests.length}</div>
                <div className="text-white/80 text-sm">Live Requests</div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Loading State */}
          {requestsLoading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
            </div>
          ) : (
            <>
              {/* Exchange Requests Section */}
              <section className="mb-12">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Live Exchange Requests</h2>
                    <p className="text-white/80 text-sm">
                      Browse live exchange requests from the network.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openRequestModal}
                    className="bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold py-2 px-6 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all duration-200"
                  >
                    Submit Exchange Request
                  </button>
                </div>

                <div className="mt-6">
                  {requestsLoading ? (
                    <div className="text-center text-white/80">Loading requests...</div>
                  ) : requests.length === 0 ? (
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 text-center border border-white/20 text-white/80">
                      No live requests yet. Be the first to submit one.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {requests.map((request) => (
                        <div
                          key={request.requestId || `${request.email}-${request.createdAt}`}
                          className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20"
                        >
                          <div className="text-white font-semibold text-lg">{request.name}</div>
                          <div className="mt-4 space-y-2 text-white/90">
                            <div className="flex items-center">
                              <span className="font-semibold">Has:</span>
                              <span className="ml-2">{formatAmount(request.haveAmount)} {request.haveCurrency}</span>
                            </div>
                            <div className="flex items-center">
                              <span className="font-semibold">Needs:</span>
                              <span className="ml-2">{request.needCurrency}</span>
                            </div>
                          </div>
                          <div className="mt-4 text-sm text-white/70">
                            Posted {getTimeAgo(request.createdAt)}
                          </div>
                          <div className="mt-4">
                            <button
                              type="button"
                              onClick={() => openMakeOfferModal(request)}
                              className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold py-2 px-4 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all duration-200"
                            >
                              Make Offer
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

        <footer className="text-center text-white/60 text-xs py-6">
          Powered by Willie Macharia, currency expert with 10 years in exchanging currency across 21 markets.
        </footer>
                </div>
              </section>

            </>
          )}
        </main>

        {/* Make Offer Modal */}
        {makeOfferModal.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Make an Offer</h2>
              
              {makeOfferModal.request && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600 font-semibold mb-1">They Have:</div>
                      <div className="text-gray-800">
                        {formatAmount(makeOfferModal.request.haveAmount)} {makeOfferModal.request.haveCurrency}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600 font-semibold mb-1">They Want:</div>
                      <div className="text-gray-800">
                        {makeOfferModal.request.needCurrency}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
                    Exchange rate info: check Google or xe.com for the current rate.
                  </div>
                </div>
              )}

              <form onSubmit={handleMakeOffer}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Your Offer Amount ({makeOfferModal.request?.needCurrency || 'currency'})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter the amount you are offering"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Your Email
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="your@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Your Phone
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="+254XXXXXXXXX"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold py-2 px-4 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all duration-200 disabled:opacity-50"
                  >
                    {submitting ? 'Sending...' : 'Send Offer'}
                  </button>
                  <button
                    type="button"
                    onClick={closeMakeOfferModal}
                    className="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-all duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}


        {/* Request Modal */}
        {requestModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-2xl">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Submit Exchange Request</h2>
              <p className="text-gray-600 mb-6">
                Share your exchange needs with the network.
              </p>

              <form onSubmit={handleSubmitRequest} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={requestForm.name}
                    onChange={(e) => setRequestForm({ ...requestForm, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 text-gray-800 focus:ring-2 focus:ring-purple-500"
                    placeholder="Your display name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={requestForm.email}
                    onChange={(e) => setRequestForm({ ...requestForm, email: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 text-gray-800 focus:ring-2 focus:ring-purple-500"
                    placeholder="you@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={requestForm.phone}
                    onChange={(e) => setRequestForm({ ...requestForm, phone: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 text-gray-800 focus:ring-2 focus:ring-purple-500"
                    placeholder="+254XXXXXXXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    I Need
                  </label>
                  <select
                    required
                    value={requestForm.needCurrency}
                    onChange={(e) => setRequestForm({ ...requestForm, needCurrency: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 text-gray-800 focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select currency</option>
                    {currencyOptions.map((option) => (
                      <option key={`need-${option}`} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    How Much Do I Have?
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={requestForm.haveAmount}
                    onChange={(e) => setRequestForm({ ...requestForm, haveAmount: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 text-gray-800 focus:ring-2 focus:ring-purple-500"
                    placeholder="Whole numbers only"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    I Have
                  </label>
                  <select
                    required
                    value={requestForm.haveCurrency}
                    onChange={(e) => setRequestForm({ ...requestForm, haveCurrency: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 text-gray-800 focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select currency</option>
                    {currencyOptions.map((option) => (
                      <option key={`have-${option}`} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeRequestModal}
                    className="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={requestSubmitting}
                    className="bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold py-2 px-6 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all duration-200 disabled:opacity-50"
                  >
                    {requestSubmitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </>
  );
}

