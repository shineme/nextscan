import { NextResponse } from 'next/server';
import { templateService } from '@/lib/template-service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { template, domain } = body;

        if (!template) {
            return NextResponse.json({ success: false, message: 'Template is required' }, { status: 400 });
        }

        const preview = templateService.preview(template, domain || 'example.com');
        return NextResponse.json({ success: true, data: { preview } });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
}
