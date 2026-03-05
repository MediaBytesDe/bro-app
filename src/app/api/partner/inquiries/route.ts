import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Admin client with service role (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "public" },
  }
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    // Auth check via server client
    const serverClient = await createServerClient();
    const { data: { user } } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    // Get partner_user record
    const { data: partnerUser } = await supabaseAdmin
      .from("partner_users")
      .select("*, partner:partners(*)")
      .eq("auth_user_id", user.id)
      .single();

    if (!partnerUser) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const partnerId = partnerUser.partner_id;

    switch (action) {
      case "list": {
        const { data: recipients, error } = await supabaseAdmin
          .from("inquiry_recipients")
          .select(`
            *,
            inquiry:inquiries(
              *, project:projects(id, name)
            )
          `)
          .eq("partner_id", partnerId)
          .order("created_at", { ascending: false });

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: recipients });
      }

      case "get": {
        const { id } = data;

        if (!id) {
          return NextResponse.json({ error: "ID ist erforderlich" }, { status: 400 });
        }

        // Verify partner is a recipient of this inquiry
        const { data: recipient, error: recipientError } = await supabaseAdmin
          .from("inquiry_recipients")
          .select("id")
          .eq("inquiry_id", id)
          .eq("partner_id", partnerId)
          .single();

        if (recipientError || !recipient) {
          return NextResponse.json({ error: "Anfrage nicht gefunden" }, { status: 404 });
        }

        // Get full inquiry data (without other partners' responses)
        const { data: inquiry, error } = await supabaseAdmin
          .from("inquiries")
          .select(`
            *,
            project:projects(id, name),
            recipients:inquiry_recipients(*),
            messages:inquiry_messages(*)
          `)
          .eq("id", id)
          .order("created_at", { referencedTable: "inquiry_messages", ascending: true })
          .single();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Get own response separately (partner should NOT see other partners' responses)
        const { data: ownResponse } = await supabaseAdmin
          .from("inquiry_responses")
          .select("*")
          .eq("inquiry_id", id)
          .eq("partner_id", partnerId)
          .maybeSingle();

        return NextResponse.json({ data: { ...inquiry, own_response: ownResponse } });
      }

      case "mark_viewed": {
        const { id } = data;

        if (!id) {
          return NextResponse.json({ error: "ID ist erforderlich" }, { status: 400 });
        }

        // Update recipient: viewed_at and status
        const { error: updateError } = await supabaseAdmin
          .from("inquiry_recipients")
          .update({
            viewed_at: new Date().toISOString(),
            status: "viewed",
          })
          .eq("inquiry_id", id)
          .eq("partner_id", partnerId)
          .eq("status", "pending");

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // If inquiry status is 'sent', update to 'in_review'
        const { data: inquiry } = await supabaseAdmin
          .from("inquiries")
          .select("status")
          .eq("id", id)
          .single();

        if (inquiry && inquiry.status === "sent") {
          await supabaseAdmin
            .from("inquiries")
            .update({ status: "in_review" })
            .eq("id", id);
        }

        return NextResponse.json({ success: true });
      }

      case "respond": {
        const {
          id, response_type, quick_text, quick_price, quick_timeframe,
          positions, total_amount, notes, valid_until, status,
        } = data;

        if (!id || !response_type || !status) {
          return NextResponse.json(
            { error: "ID, Antworttyp und Status sind erforderlich" },
            { status: 400 }
          );
        }

        // Verify partner is a recipient
        const { data: recipient, error: recipientError } = await supabaseAdmin
          .from("inquiry_recipients")
          .select("id")
          .eq("inquiry_id", id)
          .eq("partner_id", partnerId)
          .single();

        if (recipientError || !recipient) {
          return NextResponse.json({ error: "Anfrage nicht gefunden" }, { status: 404 });
        }

        // Build response data
        const responseData: Record<string, unknown> = {
          inquiry_id: id,
          partner_id: partnerId,
          response_type,
          status,
        };

        if (quick_text !== undefined) responseData.quick_text = quick_text;
        if (quick_price !== undefined) responseData.quick_price = quick_price;
        if (quick_timeframe !== undefined) responseData.quick_timeframe = quick_timeframe;
        if (positions !== undefined) responseData.positions = positions;
        if (total_amount !== undefined) responseData.total_amount = total_amount;
        if (notes !== undefined) responseData.notes = notes;
        if (valid_until !== undefined) responseData.valid_until = valid_until;

        // Upsert response (partner can update their draft)
        const { data: response, error: responseError } = await supabaseAdmin
          .from("inquiry_responses")
          .upsert(responseData, {
            onConflict: "inquiry_id,partner_id",
          })
          .select()
          .single();

        if (responseError) {
          return NextResponse.json({ error: responseError.message }, { status: 500 });
        }

        // If submitted, update recipient status and check if all responded
        if (status === "submitted") {
          // Update recipient status to responded
          await supabaseAdmin
            .from("inquiry_recipients")
            .update({
              status: "responded",
              responded_at: new Date().toISOString(),
            })
            .eq("inquiry_id", id)
            .eq("partner_id", partnerId);

          // Check if ALL recipients have responded
          const { data: allRecipients } = await supabaseAdmin
            .from("inquiry_recipients")
            .select("status")
            .eq("inquiry_id", id);

          const allResponded = allRecipients?.every((r) => r.status === "responded");

          if (allResponded) {
            await supabaseAdmin
              .from("inquiries")
              .update({ status: "answered" })
              .eq("id", id);
          }

          // Create notification for inquiry creator
          const { data: inquiry } = await supabaseAdmin
            .from("inquiries")
            .select("created_by, title")
            .eq("id", id)
            .single();

          if (inquiry) {
            await supabaseAdmin.from("notifications").insert({
              recipient_type: "profile",
              recipient_id: inquiry.created_by,
              type: "inquiry_response",
              title: "Antwort auf Ihre Anfrage",
              body: `${partnerUser.partner.company_name} hat auf "${inquiry.title}" geantwortet`,
              action_url: `/anfragen/${id}`,
            });
          }
        }

        return NextResponse.json({ data: response });
      }

      case "send_message": {
        const { id, message, attachments } = data;

        if (!id || !message) {
          return NextResponse.json(
            { error: "Anfrage-ID und Nachricht sind erforderlich" },
            { status: 400 }
          );
        }

        // Verify partner is a recipient
        const { data: recipient, error: recipientError } = await supabaseAdmin
          .from("inquiry_recipients")
          .select("id")
          .eq("inquiry_id", id)
          .eq("partner_id", partnerId)
          .single();

        if (recipientError || !recipient) {
          return NextResponse.json({ error: "Anfrage nicht gefunden" }, { status: 404 });
        }

        // Insert message
        const insertData: Record<string, unknown> = {
          inquiry_id: id,
          sender_type: "partner",
          sender_id: partnerUser.id,
          sender_name: partnerUser.display_name || "Partner",
          message,
        };

        if (attachments !== undefined) insertData.attachments = attachments;

        const { data: msg, error } = await supabaseAdmin
          .from("inquiry_messages")
          .insert(insertData)
          .select()
          .single();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Create notification for inquiry creator
        const { data: inquiry } = await supabaseAdmin
          .from("inquiries")
          .select("created_by, title")
          .eq("id", id)
          .single();

        if (inquiry) {
          await supabaseAdmin.from("notifications").insert({
            recipient_type: "profile",
            recipient_id: inquiry.created_by,
            type: "inquiry_message",
            title: "Neue Nachricht zu Ihrer Anfrage",
            body: `${partnerUser.display_name || partnerUser.partner.company_name} hat eine Nachricht zu "${inquiry.title}" gesendet`,
            action_url: `/anfragen/${id}`,
          });
        }

        return NextResponse.json({ data: msg });
      }

      default:
        return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server-Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
