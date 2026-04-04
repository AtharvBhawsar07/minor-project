import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { libraryCardsAPI, booksAPI } from '../services/api';

const normalizeAPIResponse = (response) => {
  if (!response) return null;
  if (response.data && typeof response.data === 'object' && 'data' in response.data) {
    return response.data.data;
  }
  return response.data;
};

const RequestCardPage = () => {
  const { currentUser } = useAuth();

  const [form, setForm] = useState({
    course: '',
    branch: '',
    year: '',
    type: 'temporary',
    notes: '',
    bookId: ''
  });
  const [status, setStatus] = useState(null); // 'idle', 'loading', 'success', 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [existingCards, setExistingCards] = useState([]);
  const [books, setBooks] = useState([]);

  useEffect(() => {
    // Check if they already have cards
    libraryCardsAPI.getAll()
      .then(res => {
        const cards = normalizeAPIResponse(res);
        setExistingCards(Array.isArray(cards) ? cards : []);
      })
      .catch(err => {
        if (err.statusCode !== 404) console.error(err);
        setExistingCards([]);
      });

    booksAPI.getAll()
      .then(res => {
        const b = normalizeAPIResponse(res);
        setBooks(Array.isArray(b) ? b.filter(book => book.availableCopies > 0) : []);
      })
      .catch(console.error);
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (existingCards.length >= 5) {
      setStatus('error');
      setErrorMsg('Maximum 5 cards allowed');
      return;
    }

    const selectedBook = books.find(b => b._id === form.bookId);
    if (!selectedBook || selectedBook.availableCopies === 0) {
      setStatus('error');
      setErrorMsg('Book not available');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await libraryCardsAPI.apply(form);
      const newCard = normalizeAPIResponse(res);
      
      const requests = [...existingCards];
      requests.push(newCard); // Using push as required
      setExistingCards(requests);
      
      setStatus('success');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err.message || 'Failed to submit application.');
    }
  };

  // Calculate card usage
  const approvedCards = existingCards.filter(card => card.status === 'approved');
  const pendingCards = existingCards.filter(card => card.status === 'pending');
  const tempCards = approvedCards.filter(card => card.type === 'temporary');
  const permCards = approvedCards.filter(card => card.type === 'permanent');
  const canRequestMore = approvedCards.length < 5 && pendingCards.length < 2;
  const canRequestTemp = tempCards < 3;
  const canRequestPerm = permCards < 2;

  return (
    <div className="page-wrapper">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-8">
            <div className="mb-4">
              <h2 className="section-title">
                <i className="bi bi-credit-card me-2" style={{ color: 'var(--accent)' }}></i>
                Request Library Card
              </h2>
              <p className="section-subtitle">Apply for a digital library card to borrow books</p>
            </div>

            {/* Card Usage Summary */}
            <div className="lib-card mb-4 p-3">
              <h6 className="mb-3">Your Library Cards</h6>
              <div className="row text-center">
                <div className="col-3">
                  <div className="text-success fw-bold">{approvedCards.length}</div>
                  <small className="text-muted">Approved</small>
                </div>
                <div className="col-3">
                  <div className="text-warning fw-bold">{pendingCards.length}</div>
                  <small className="text-muted">Pending</small>
                </div>
                <div className="col-3">
                  <div className="text-info fw-bold">{tempCards.length}/3</div>
                  <small className="text-muted">Temporary</small>
                </div>
                <div className="col-3">
                  <div className="text-primary fw-bold">{permCards.length}/2</div>
                  <small className="text-muted">Permanent</small>
                </div>
              </div>
              <div className="mt-3 text-center">
                <span className="badge bg-success">Cards used: {approvedCards.length}/5</span>
              </div>
            </div>

            {/* Existing Cards Display */}
            {existingCards.length > 0 && (
              <div className="lib-card mb-4 p-4">
                <h6 className="mb-3">Your Library Cards</h6>
                <div className="row">
                  {existingCards.map((card, index) => (
                    <div key={card._id || index} className="col-md-6 mb-3">
                      <div className="border rounded p-3">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <strong>Card #{card.cardNumber?.slice(-4) || 'N/A'}</strong>
                            <div className={`badge-role badge-${card.status.toLowerCase()} mt-1`}>
                              {card.status}
                            </div>
                            <div className="text-muted small mt-1">
                              Type: {card.type} • Book: {card.book?.title || 'None'}
                            </div>
                          </div>
                          {card.status === 'rejected' && (
                            <div className="text-danger small">
                              <strong>Reason:</strong> {card.rejectionReason || 'No reason'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Request Form */}
            {canRequestMore ? (
              <div className="lib-card p-4">
                {status === 'success' && (
                  <div className="alert alert-success lib-alert mb-4">
                    <i className="bi bi-check-circle-fill me-2"></i>Application submitted successfully! It is now pending review.
                  </div>
                )}

                {status === 'error' && (
                  <div className="alert alert-danger mb-4">{errorMsg}</div>
                )}

                {status !== 'success' && (
                  <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                      <label className="lib-label">Student Name</label>
                      <input type="text" className="form-control" value={currentUser?.name || ''} disabled />
                    </div>
                    
                    <div className="mb-3">
                      <label className="lib-label">Student ID</label>
                      <input type="text" className="form-control" value={currentUser?.studentId || ''} disabled />
                    </div>

                    <div className="mb-3">
                      <label className="lib-label">Issue Type</label>
                      <select name="type" className="form-select" value={form.type} onChange={handleChange}>
                        <option value="temporary" disabled={!canRequestTemp}>
                          Temporary (15 Days) {canRequestTemp ? '' : '(Limit reached)'}
                        </option>
                        <option value="permanent" disabled={!canRequestPerm}>
                          Permanent (Semester End) {canRequestPerm ? '' : '(Limit reached)'}
                        </option>
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="lib-label">Select Book</label>
                      <select name="bookId" className="form-select" value={form.bookId} onChange={handleChange} required>
                        <option value="">-- Choose a Book --</option>
                        {books.map(b => (
                          <option key={b._id} value={b._id}>{b.title} (Avail: {b.availableCopies})</option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="lib-label">Course</label>
                      <select name="course" className="form-select" value={form.course} onChange={handleChange} required>
                        <option value="">Select Course</option>
                        <option value="BTech">B.Tech</option>
                        <option value="Pharmacy">Pharmacy</option>
                        <option value="Law">Law</option>
                        <option value="MBA">MBA</option>
                        <option value="BCom">B.Com</option>
                        <option value="BCA">BCA</option>
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="lib-label">Branch</label>
                      <input type="text" name="branch" className="form-control" value={form.branch} onChange={handleChange} required placeholder="e.g. CSE, IT" />
                    </div>

                    <div className="mb-3">
                      <label className="lib-label">Year</label>
                      <input type="text" name="year" className="form-control" value={form.year} onChange={handleChange} required placeholder="e.g. 1st Year, 2nd Year" />
                    </div>

                    <div className="mb-3">
                      <label className="lib-label">Application Notes (Optional)</label>
                      <textarea 
                        name="notes"
                        className="form-control" 
                        rows="3" 
                        value={form.notes} 
                        onChange={handleChange}
                        placeholder="Any additional information for the librarian..."
                      ></textarea>
                    </div>

                    <button type="submit" className="btn btn-lib-primary" disabled={status === 'loading'}>
                      {status === 'loading' ? 'Submitting...' : 'Submit Application'}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <div className="lib-card p-4 text-center">
                <div className="alert alert-warning">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  <strong>Card Limit Reached</strong>
                  <p className="mb-0 mt-2">
                    You have reached the maximum limit of {approvedCards.length} approved cards or have too many pending applications.
                  </p>
                </div>
              </div>
            )}
            
            <div className="alert lib-alert alert-info mt-3" style={{ background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.2)', color: '#4338ca' }}>
              <i className="bi bi-info-circle me-2"></i>
              <strong>Note:</strong> Library cards are typically approved within 1–2 working days. Once approved, you can visit the library to get books issued to your account.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestCardPage;
