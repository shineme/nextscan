import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const username = request.cookies.get('auth_user')?.value;
    
    if (username) {
        return NextResponse.json({ 
            success: true, 
            user: { username } 
        });
    } else {
        return NextResponse.json({ 
            success: false, 
            message: 'Not authenticated' 
        }, { status: 401 });
    }
}
