import { NextResponse } from 'next/server';

export async function POST() {
    const response = NextResponse.json({ success: true });
    
    // 删除 cookie
    response.cookies.delete('auth_user');
    
    return response;
}
