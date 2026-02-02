import { NextRequest, NextResponse } from 'next/server';
import { 
  getAllBorrowerApplications, 
  getBorrowerApplicationByAddress,
  addBorrowerApplication, 
  updateBorrowerApplication 
} from '@/lib/db';

// GET /api/borrower-applications - Get all applications or check status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (address) {
      // Get specific application by address
      const application = await getBorrowerApplicationByAddress(address);
      return NextResponse.json(application);
    }

    // Get all applications
    const applications = await getAllBorrowerApplications();
    return NextResponse.json(applications);
  } catch (error) {
    console.error('Failed to get borrower applications:', error);
    return NextResponse.json({ error: 'Failed to get applications' }, { status: 500 });
  }
}

// POST /api/borrower-applications - Submit a new application
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      applicantAddress, 
      companyName, 
      contactEmail, 
      website, 
      description, 
      requestedLimit 
    } = body;

    if (!applicantAddress || !companyName || !contactEmail || !description || !requestedLimit) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const application = await addBorrowerApplication({
      applicantAddress,
      companyName,
      contactEmail,
      website,
      description,
      requestedLimit,
    });

    return NextResponse.json(application, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create borrower application:', error);
    if (error.message === 'Application already pending') {
      return NextResponse.json({ error: 'You already have a pending application' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create application' }, { status: 500 });
  }
}

// PATCH /api/borrower-applications - Update application status
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Application ID is required' }, { status: 400 });
    }

    await updateBorrowerApplication(id, updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update borrower application:', error);
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 });
  }
}
