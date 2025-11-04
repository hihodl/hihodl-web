import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);

export async function POST(req: NextRequest) {
  try {
    const { email, displayName } = await req.json();

    if (!email || !displayName) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }

    // Verificar variables de entorno antes de crear cliente
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json({ error: 'server_config_error' }, { status: 500 });
    }

    const supabase = createSupabaseClient(true);

    // Idempotencia por email - devolver link existente si ya existe
    const { data: existing } = await supabase
      .from('waitlist_users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        ok: true,
        referralCode: existing.referral_code,
        alreadyExists: true,
      });
    }

    // Leer cookie de referido
    const referredBy = req.cookies.get('hihodl_ref')?.value ?? null;

    // Crear código de referido propio
    const myCode = nanoid();

    const { data: user, error } = await supabase
      .from('waitlist_users')
      .insert({
        email,
        display_name: displayName,
        referral_code: myCode,
        referred_by_code: referredBy || null,
        referrals_count: 0,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Database error:', error);
      // Mensajes de error más específicos
      if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        return NextResponse.json({ 
          error: 'database_not_configured',
          message: 'Database tables not found. Please run the SQL schema in Supabase.' 
        }, { status: 500 });
      }
      return NextResponse.json({ 
        error: 'database_error',
        message: error.message || 'Database operation failed' 
      }, { status: 500 });
    }

    // Si hay referrer, incrementar contador + registrar evento
    if (referredBy && referredBy !== myCode) {
      const { data: referrer } = await supabase
        .from('waitlist_users')
        .select('referral_code, email')
        .eq('referral_code', referredBy)
        .maybeSingle();

      if (referrer) {
        // Verificar que no sea auto-referral (mismo email o dominio similar)
        const referrerDomain = referrer.email.split('@')[1];
        const userDomain = email.split('@')[1];
        
        // Solo contar si no es del mismo dominio (anti-fraude básico)
        if (referrerDomain !== userDomain) {
          const { error: rpcError } = await supabase.rpc('increment_referrals_count', {
            p_ref_code: referredBy,
          });
          if (rpcError) console.error('Error incrementing referrals:', rpcError);

          const { error: insertError } = await supabase.from('referral_events').insert({
            referrer_code: referredBy,
            referred_user_id: user.id,
          });
          if (insertError) console.error('Error inserting referral event:', insertError);
        }
      }
    }

    // Enviar email con link de referido (asíncrono, no bloquea respuesta)
    sendWelcomeEmail(email, displayName, myCode).catch(console.error);

    return NextResponse.json({
      ok: true,
      referralCode: myCode,
      alreadyExists: false,
    });
  } catch (e) {
    console.error('Error in waitlist join:', e);
    
    // Manejo de errores específicos
    if (e instanceof Error && e.message.includes('Missing Supabase')) {
      return NextResponse.json({ 
        error: 'config_error',
        message: 'Supabase configuration missing. Please check environment variables.' 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: 'server_error',
      message: e instanceof Error ? e.message : 'An unexpected error occurred' 
    }, { status: 500 });
  }
}

// Función helper para enviar email (implementar con Resend)
async function sendWelcomeEmail(email: string, displayName: string, referralCode: string) {
  // Solo enviar si Resend está configurado
  if (!process.env.RESEND_API_KEY) {
    console.log('Resend not configured, skipping email');
    return;
  }

  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.hihodl.xyz';
  const referralLink = `${siteUrl}/?ref=${referralCode}`;

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'HIHODL <noreply@hihodl.xyz>',
      to: email,
      subject: 'Welcome to HIHODL Beta! 🚀', // 📧 ASUNTO DEL EMAIL - Puedes cambiarlo aquí
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0A141E; color: #eaf6ff; padding: 40px 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #0A141E; border-radius: 16px;">
            
            <!-- 📝 MENSAJE DE BIENVENIDA -->
            <h1 style="color: #FFB703; font-size: 32px; margin-bottom: 20px;">Welcome ${displayName}! 🎉</h1>
            <p style="font-size: 18px; line-height: 1.6; margin-bottom: 30px;">
              You're now part of the HIHODL beta waitlist. Early access isn't given—it's earned.
            </p>
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
              Share your referral link to climb the leaderboard and unlock exclusive perks:
            </p>
            
            <!-- 🔗 LINK DE REFERIDO ÚNICO -->
            <div style="background: rgba(255, 255, 255, 0.1); padding: 24px; border-radius: 12px; margin: 30px 0;">
              <p style="margin: 0 0 12px; font-weight: 600;">Your Referral Link:</p>
              <a href="${referralLink}" style="color: #FFB703; word-break: break-all; text-decoration: none; font-size: 14px;">
                ${referralLink}
              </a>
            </div>
            
            <!-- 📊 LINK AL LEADERBOARD -->
            <div style="margin: 30px 0;">
              <a href="${siteUrl}/leaderboard" style="display: inline-block; background: #FFB703; color: #0A141E; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; text-align: center;">
                View Leaderboard →
              </a>
            </div>
            
            <!-- 🏆 LISTA DE MILESTONES -->
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
              <h3 style="font-size: 18px; margin-bottom: 16px;">Milestones to Unlock:</h3>
              <ul style="list-style: none; padding: 0; margin: 0;">
                <li style="margin-bottom: 12px;">🏗️ <strong>Builders Club</strong> — at 3 referrals</li>
                <li style="margin-bottom: 12px;">⭐ <strong>Priority Beta</strong> — at 10 referrals</li>
                <li style="margin-bottom: 12px;">🎯 <strong>Alias Reservation</strong> — at 25 referrals</li>
                <li style="margin-bottom: 12px;">👑 <strong>Ambassador</strong> — at 50 referrals</li>
                <li style="margin-bottom: 12px;">💎 <strong>Legend</strong> — at 100 referrals</li>
              </ul>
            </div>
            
            <!-- 👋 FIRMA -->
            <p style="margin-top: 40px; font-size: 14px; color: #94a3b8; text-align: center;">
              See you at the top! 🚀<br/>
              The HIHODL Team
            </p>
          </div>
        </body>
        </html>
      `,
    });
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

