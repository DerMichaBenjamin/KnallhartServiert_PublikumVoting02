import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabaseAdmin().from('events').select('date').order('date', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const dates = Array.from(new Set((data || []).map(x => x.date)));
  return NextResponse.json({ dates });
}
