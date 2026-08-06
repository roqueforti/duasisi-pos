import { NextResponse } from 'next/server';
import { gasAction } from '@/lib/db';

export async function GET() {
  try {
    const data = await gasAction<any[]>('getRequirements');
    
    // Format data so it matches what the frontend expects
    const formattedData = data.map((item: any) => ({
      ...item,
      createdAt: item.created_at,
      laundryType: item.laundry_type,
      painPoints: item.pain_points,
    }));

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Error reading requirements from backend:', error);
    return NextResponse.json({ error: 'Failed to read requirements' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const newReq = await request.json();
    
    const data = await gasAction<any>('saveRequirement', newReq);
    
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error saving requirement to backend:', error);
    return NextResponse.json({ error: 'Failed to save requirement' }, { status: 500 });
  }
}
