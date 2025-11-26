import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username, password } = body;

        const stmt = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?');
        const user = stmt.get(username, password) as { username: string } | undefined;

        if (user) {
            const response = NextResponse.json({ 
                success: true, 
                user: { username: user.username } 
            });
            
            // 设置 cookie 保存登录状态（7天过期）
            response.cookies.set('auth_user', user.username, {
                httpOnly: false, // 允许客户端读取
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 7, // 7 天
                path: '/',
            });
            
            return response;
        } else {
            return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
        }
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
    }
}
