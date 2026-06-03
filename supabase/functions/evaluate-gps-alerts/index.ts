import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Clean and format phone numbers for WhatsApp
function formatWhatsAppPhone(phone: string) {
    if (!phone) return '';
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length === 10) {
        cleaned = '52' + cleaned;
    }
    return cleaned;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const samsaraToken = Deno.env.get('SAMSARA_API_TOKEN') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase environment variables not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch active alerts with unit details
    const { data: alerts, error: alertsErr } = await supabase
        .from('whatsapp_gps_alerts')
        .select(`
            *,
            units (
                id,
                economic_number,
                placas,
                current_operator_id
            )
        `)
        .eq('status', 'Programada');

    if (alertsErr) throw alertsErr;

    if (!alerts || alerts.length === 0) {
        return new Response(JSON.stringify({ message: "No active alerts to evaluate" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    // Fetch operators data separately to avoid nested join parsing issues if needed
    const { data: opsData } = await supabase.from('operators').select('id, name, phone');
    const operatorsMap = new Map((opsData || []).map(o => [o.id, o]));

    // 2. Fetch live vehicle locations from Samsara
    let samsaraLocations = [];
    if (samsaraToken) {
        try {
            const res = await fetch('https://api.samsara.com/fleet/vehicles/locations', {
                headers: {
                    'Authorization': `Bearer ${samsaraToken}`,
                    'Accept': 'application/json'
                }
            });
            if (res.ok) {
                const data = await res.json();
                samsaraLocations = data.data || [];
            } else {
                console.error("Samsara API returned status:", res.status);
            }
        } catch (e) {
            console.error("Failed to fetch Samsara locations:", e);
        }
    }

    // 3. Get webhook settings from system_settings table
    let webhookUrl = '';
    let webhookEnabled = false;
    const { data: dbSetting } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'gps_alert_webhook')
        .maybeSingle();

    if (dbSetting && dbSetting.setting_value) {
        webhookUrl = dbSetting.setting_value.url || '';
        webhookEnabled = dbSetting.setting_value.enabled === true;
    }

    const triggeredAlerts = [];

    // 4. Evaluate each alert
    for (const alert of alerts) {
        const unit = alert.units;
        if (!unit) continue;

        const unitNum = unit.economic_number || 'S/U';
        const opId = unit.current_operator_id;
        const operator = opId ? operatorsMap.get(opId) : null;
        const operatorName = operator ? operator.name : 'Sin Operador';

        // Find match in Samsara locations
        const samsaraMatch = samsaraLocations.find((s: any) => 
            s.name.includes(unitNum) || (unit.placas && s.name.includes(unit.placas))
        );

        if (!samsaraMatch || !samsaraMatch.location) continue;

        const lat = samsaraMatch.location.latitude;
        const lng = samsaraMatch.location.longitude;

        const distanceKm = getDistanceKm(lat, lng, Number(alert.latitude), Number(alert.longitude));

        if (distanceKm <= Number(alert.radius_km)) {
            console.log(`GPS-WORKER: Alert ${alert.id} triggered. Distance is ${distanceKm.toFixed(2)} km.`);
            
            // Mark as triggered in DB
            await supabase
                .from('whatsapp_gps_alerts')
                .update({ status: 'Disparada', triggered_at: new Date().toISOString() })
                .eq('id', alert.id);

            // Construct WhatsApp Notification Message
            const atcMsg = alert.atc_message || '';
            const qualMsg = alert.quality_message || '';
            const fullMessage = `🚨 *NOTIFICACIÓN DE ARRIBADA GPS* 🚨\n\n🚛 *Unidad:* ${unitNum}\n👤 *Operador:* ${operatorName}\n📍 *Destino:* ${alert.destination_name}\n\n====================\n💬 *INSTRUCCIONES ATC:*\n${atcMsg}\n\n====================\n⭐ *CALIDAD Y SEGURO YORO:*\n${qualMsg}`;

            // Dispatch webhook if active
            if (webhookEnabled && webhookUrl) {
                try {
                    console.log(`GPS-WORKER: Dispatching webhook for alert ${alert.id} to ${webhookUrl}`);
                    const webRes = await fetch(webhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            event: 'gps_alert_arrival',
                            unit: unitNum,
                            operator: operatorName,
                            destination: alert.destination_name,
                            atc_message: atcMsg,
                            quality_message: qualMsg,
                            full_text: fullMessage,
                            recipients: alert.recipients,
                            timestamp: new Date().toISOString()
                        })
                    });

                    if (webRes.ok) {
                        console.log(`GPS-WORKER: Webhook successfully triggered for alert ${alert.id}.`);
                        // Mark as Sent
                        await supabase
                            .from('whatsapp_gps_alerts')
                            .update({ status: 'Enviada' })
                            .eq('id', alert.id);
                    } else {
                        console.error(`GPS-WORKER: Webhook returned error code ${webRes.status}`);
                    }
                } catch (webErr) {
                    console.error(`GPS-WORKER: Failed to POST to webhook for alert ${alert.id}:`, webErr);
                }
            } else {
                console.warn(`GPS-WORKER: Webhook is disabled or not configured. Alert ${alert.id} left in 'Disparada' status.`);
            }

            triggeredAlerts.push({
                id: alert.id,
                unit: unitNum,
                destination: alert.destination_name,
                distance_km: distanceKm
            });
        }
    }

    return new Response(JSON.stringify({ 
        message: "Proximity evaluation finished", 
        evaluated_count: alerts.length,
        triggered_count: triggeredAlerts.length,
        triggered_alerts: triggeredAlerts
    }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
