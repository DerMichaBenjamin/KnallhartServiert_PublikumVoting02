import { NextResponse } from 'next/server';import { createAdminLoginResponse, isValidAdminPassword } from '@/lib/adminAuth';
export async function POST(req:Request){const body=await req.json().catch(()=>({}));if(!isValidAdminPassword(body.password||''))return NextResponse.json({ok:false,error:'Falsches Passwort.'},{status:401});return createAdminLoginResponse();}
