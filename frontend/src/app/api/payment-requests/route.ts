import { NextRequest, NextResponse } from 'next/server';
import { 
  getAllPaymentRequests, 
  getPaymentRequestsForBorrower, 
  getPaymentRequestsForPublisher,
  addPaymentRequest, 
  updatePaymentRequest 
} from '@/lib/db';

// GET /api/payment-requests - Get payment requests
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const borrower = searchParams.get('borrower');
    const publisher = searchParams.get('publisher');

    let requests;
    if (borrower) {
      requests = await getPaymentRequestsForBorrower(borrower);
    } else if (publisher) {
      requests = await getPaymentRequestsForPublisher(publisher);
    } else {
      requests = await getAllPaymentRequests();
    }

    return NextResponse.json(requests);
  } catch (error) {
    console.error('Failed to get payment requests:', error);
    return NextResponse.json({ error: 'Failed to get payment requests' }, { status: 500 });
  }
}

// POST /api/payment-requests - Create a new payment request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { publisherAddress, publisherName, borrowerAddress, amount, appexPercentage, note } = body;

    if (!publisherAddress || !borrowerAddress || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const paymentRequest = await addPaymentRequest({
      publisherAddress,
      publisherName,
      borrowerAddress,
      amount,
      appexPercentage: appexPercentage || 0,
      note,
    });

    return NextResponse.json(paymentRequest, { status: 201 });
  } catch (error) {
    console.error('Failed to create payment request:', error);
    return NextResponse.json({ error: 'Failed to create payment request' }, { status: 500 });
  }
}

// PATCH /api/payment-requests - Update a payment request
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await updatePaymentRequest(id, updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update payment request:', error);
    return NextResponse.json({ error: 'Failed to update payment request' }, { status: 500 });
  }
}
