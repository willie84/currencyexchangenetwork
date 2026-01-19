import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function RequestOffersPage() {
  const router = useRouter();
  const { requestId } = router.query;
  const [offers, setOffers] = useState([]);
  const [requestDetails, setRequestDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    if (!requestId) return;

    const fetchOffers = async () => {
      try {
        const response = await fetch(`/api/requests/${requestId}/offers`);
        if (!response.ok) {
          let message = 'Failed to load offers';
          try {
            const data = await response.json();
            if (data?.error) message = data.error;
            if (data?.details) message = `${message}: ${data.details}`;
          } catch (_) {
            // ignore
          }
          throw new Error(message);
        }
        const data = await response.json();
        const sorted = Array.isArray(data)
          ? data.sort((a, b) => (b.offerAmount || 0) - (a.offerAmount || 0))
          : [];
        setOffers(sorted);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const fetchRequestDetails = async () => {
      try {
        const response = await fetch('/api/requests');
        if (!response.ok) return;
        const data = await response.json();
        const match = Array.isArray(data)
          ? data.find((item) => (item.requestId || item.uuid) === requestId)
          : null;
        setRequestDetails(match || null);
      } catch (_) {
        // ignore
      }
    };

    fetchOffers();
    fetchRequestDetails();
  }, [requestId]);

  const formatAmount = (value) => {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric.toLocaleString() : '—';
  };

  const handleAcceptOffer = async (offer) => {
    if (!requestId || !offer?.offerId) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/requests/${requestId}/offers/${offer.offerId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer }),
      });
      if (!response.ok) {
        let message = 'Failed to accept offer';
        try {
          const data = await response.json();
          if (data?.error) message = data.error;
          if (data?.details) message = `${message}: ${data.details}`;
        } catch (_) {
          // ignore
        }
        throw new Error(message);
      }

      setOffers((prev) =>
        prev.map((item) =>
          item.offerId === offer.offerId
            ? { ...item, accepted: true, acceptedAt: new Date().toISOString() }
            : item
        )
      );
      setSuccessMessage('Offer accepted. Email sent to the request owner.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseRequest = async () => {
    if (!requestId) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/requests/${requestId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        let message = 'Failed to close request';
        try {
          const data = await response.json();
          if (data?.error) message = data.error;
          if (data?.details) message = `${message}: ${data.details}`;
        } catch (_) {
          // ignore
        }
        throw new Error(message);
      }

      setSuccessMessage('Request closed.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Request Offers</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-purple-800">
        {successMessage && (
          <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg">
            {successMessage}
          </div>
        )}
        {error && (
          <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg">
            Error: {error}
          </div>
        )}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6">
            <h1 className="text-2xl font-bold text-white mb-1">Offers for Your Request</h1>
            <p className="text-white/80 text-sm">
              This page is intended for the request owner. Share it only if needed.
            </p>
            <p className="text-white/60 text-xs mt-2 break-all">
              Request ID: {requestId || '—'}
            </p>
            {requestDetails?.status === 'closed' && (
              <div className="mt-4 bg-red-500/20 text-red-100 border border-red-400/40 rounded-lg px-4 py-2 text-sm">
                This exchange request is closed.
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleCloseRequest}
              disabled={submitting || requestDetails?.status === 'closed'}
              className="bg-white/20 text-white font-semibold py-2 px-4 rounded-lg hover:bg-white/30 transition-all duration-200 disabled:opacity-50"
            >
              Close Request
            </button>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="text-white/80 text-center py-16">Loading offers...</div>
            ) : error ? (
              <div className="bg-red-500/20 text-red-100 border border-red-400/40 rounded-xl p-4">
                {error}
              </div>
            ) : offers.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 text-center border border-white/20 text-white/80">
                No offers yet.
              </div>
            ) : (
              <div className="space-y-4">
                {offers.map((offer, index) => (
                  <div
                    key={offer.offerId || `${offer.responderEmail}-${index}`}
                    className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-white font-semibold">
                        {offer.responderName || 'Responder'}
                      </div>
                      {index === 0 && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          Highest
                        </span>
                      )}
                    </div>
                    <div className="mt-3 text-white">
                      Offer Amount:{' '}
                      <span className="font-semibold">
                        {formatAmount(offer.offerAmount)} {offer.needCurrency || 'currency'}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      {offer.accepted ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          Accepted
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAcceptOffer(offer)}
                          disabled={submitting || requestDetails?.status === 'closed'}
                          className="bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold py-2 px-4 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all duration-200 disabled:opacity-50"
                        >
                          Accept Offer
                        </button>
                      )}
                      {offer.acceptedAt && (
                        <span className="text-xs text-white/70">
                          Accepted {new Date(offer.acceptedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

