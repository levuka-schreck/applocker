import { NextRequest, NextResponse } from 'next/server';
import { getAllPartners, addPartner, removePartner, updatePartner } from '@/lib/db';

// GET /api/partners - Get all partners
export async function GET() {
  try {
    const partners = await getAllPartners();
    return NextResponse.json(partners);
  } catch (error) {
    console.error('Failed to get partners:', error);
    return NextResponse.json({ error: 'Failed to get partners' }, { status: 500 });
  }
}

// POST /api/partners - Add a new partner
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, name, borrowLimit, lpYieldRate, protocolFeeRate, approved = true } = body;

    if (!address || !name || !borrowLimit) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const partner = await addPartner({
      address,
      name,
      borrowLimit,
      lpYieldRate: lpYieldRate || 500,
      protocolFeeRate: protocolFeeRate || 200,
      approved,
    });

    return NextResponse.json(partner, { status: 201 });
  } catch (error) {
    console.error('Failed to add partner:', error);
    return NextResponse.json({ error: 'Failed to add partner' }, { status: 500 });
  }
}

// DELETE /api/partners - Remove a partner
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    await removePartner(address);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to remove partner:', error);
    return NextResponse.json({ error: 'Failed to remove partner' }, { status: 500 });
  }
}

// PATCH /api/partners - Update a partner
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, ...updates } = body;

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    await updatePartner(address, updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update partner:', error);
    return NextResponse.json({ error: 'Failed to update partner' }, { status: 500 });
  }
}
