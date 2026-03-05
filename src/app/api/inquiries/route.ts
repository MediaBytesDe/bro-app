import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    // Role check - only staff can manage inquiries
    const { data: profile } = await supabase
      .from("users")
      .select("role, display_name")
      .eq("auth_id", user.id)
      .single();

    if (!profile || !["admin", "mitarbeiter", "superadmin"].includes(profile.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    switch (action) {
      case "list": {
        const { status, trade, project_id } = data;

        let query = supabase
          .from("inquiries")
          .select("*, project:projects(id, name), recipients:inquiry_recipients(id, partner_id, status, partner:partners(id, company_name))")
          .order("created_at", { ascending: false });

        if (status) {
          query = query.eq("status", status);
        }
        if (trade) {
          query = query.eq("trade", trade);
        }
        if (project_id) {
          query = query.eq("project_id", project_id);
        }

        const { data: inquiries, error } = await query;

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: inquiries });
      }

      case "get": {
        const { id } = data;

        if (!id) {
          return NextResponse.json({ error: "ID ist erforderlich" }, { status: 400 });
        }

        const { data: inquiry, error } = await supabase
          .from("inquiries")
          .select(`
            *,
            project:projects(id, name),
            recipients:inquiry_recipients(*, partner:partners(id, company_name, trade)),
            responses:inquiry_responses(*, partner:partners(id, company_name)),
            messages:inquiry_messages(*)
          `)
          .eq("id", id)
          .order("created_at", { referencedTable: "inquiry_messages", ascending: true })
          .single();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: inquiry });
      }

      case "create": {
        const {
          title, trade, description, project_id, template_id,
          urgency, location_notes, checklist_data, photos, mode,
        } = data;

        if (!title || !trade) {
          return NextResponse.json(
            { error: "Titel und Gewerk sind erforderlich" },
            { status: 400 }
          );
        }

        const insertData: Record<string, unknown> = {
          title,
          trade,
          status: "draft",
          created_by: user.id,
        };

        if (description !== undefined) insertData.description = description;
        if (project_id !== undefined) insertData.project_id = project_id;
        if (template_id !== undefined) insertData.template_id = template_id;
        if (urgency !== undefined) insertData.urgency = urgency;
        if (location_notes !== undefined) insertData.location_notes = location_notes;
        if (checklist_data !== undefined) insertData.checklist_data = checklist_data;
        if (photos !== undefined) insertData.photos = photos;
        if (mode !== undefined) insertData.mode = mode;

        const { data: inquiry, error } = await supabase
          .from("inquiries")
          .insert(insertData)
          .select()
          .single();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: inquiry });
      }

      case "update": {
        const {
          id, title, description, trade, urgency,
          location_notes, checklist_data, photos, mode, project_id, template_id,
        } = data;

        if (!id) {
          return NextResponse.json({ error: "ID ist erforderlich" }, { status: 400 });
        }

        // Only allow update if status is draft
        const { data: existing, error: fetchError } = await supabase
          .from("inquiries")
          .select("status")
          .eq("id", id)
          .single();

        if (fetchError) {
          return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        if (existing.status !== "draft") {
          return NextResponse.json(
            { error: "Nur Entwürfe können bearbeitet werden" },
            { status: 400 }
          );
        }

        const updateData: Record<string, unknown> = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (trade !== undefined) updateData.trade = trade;
        if (urgency !== undefined) updateData.urgency = urgency;
        if (location_notes !== undefined) updateData.location_notes = location_notes;
        if (checklist_data !== undefined) updateData.checklist_data = checklist_data;
        if (photos !== undefined) updateData.photos = photos;
        if (mode !== undefined) updateData.mode = mode;
        if (project_id !== undefined) updateData.project_id = project_id;
        if (template_id !== undefined) updateData.template_id = template_id;

        if (Object.keys(updateData).length === 0) {
          return NextResponse.json(
            { error: "Keine Felder zum Aktualisieren" },
            { status: 400 }
          );
        }

        const { data: inquiry, error } = await supabase
          .from("inquiries")
          .update(updateData)
          .eq("id", id)
          .select()
          .single();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: inquiry });
      }

      case "send": {
        const { id, recipient_ids } = data;

        if (!id || !recipient_ids || !Array.isArray(recipient_ids) || recipient_ids.length === 0) {
          return NextResponse.json(
            { error: "ID und Empfänger sind erforderlich" },
            { status: 400 }
          );
        }

        // Validate inquiry exists and is draft
        const { data: inquiry, error: fetchError } = await supabase
          .from("inquiries")
          .select("*")
          .eq("id", id)
          .single();

        if (fetchError) {
          return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        if (inquiry.status !== "draft") {
          return NextResponse.json(
            { error: "Nur Entwürfe können versendet werden" },
            { status: 400 }
          );
        }

        // Update inquiry status to sent
        const { error: updateError } = await supabase
          .from("inquiries")
          .update({ status: "sent" })
          .eq("id", id);

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // Create inquiry_recipients entries
        const recipientEntries = recipient_ids.map((partnerId: string) => ({
          inquiry_id: id,
          partner_id: partnerId,
          status: "pending",
        }));

        const { error: recipientError } = await supabase
          .from("inquiry_recipients")
          .insert(recipientEntries);

        if (recipientError) {
          return NextResponse.json({ error: recipientError.message }, { status: 500 });
        }

        // Create notifications for partner admin users
        const { data: partnerUsers } = await supabase
          .from("partner_users")
          .select("id, partner_id")
          .in("partner_id", recipient_ids)
          .eq("role", "admin");

        if (partnerUsers && partnerUsers.length > 0) {
          const notifications = partnerUsers.map((pu) => ({
            recipient_type: "partner_user",
            recipient_id: pu.id,
            type: "new_inquiry",
            title: "Neue Anfrage erhalten",
            body: inquiry.title,
            action_url: `/partner/anfragen/${inquiry.id}`,
          }));

          await supabase.from("notifications").insert(notifications);
        }

        // Return updated inquiry
        const { data: updatedInquiry, error: getError } = await supabase
          .from("inquiries")
          .select("*")
          .eq("id", id)
          .single();

        if (getError) {
          return NextResponse.json({ error: getError.message }, { status: 500 });
        }

        return NextResponse.json({ data: updatedInquiry });
      }

      case "accept_response": {
        const { id, partner_id } = data;

        if (!id || !partner_id) {
          return NextResponse.json(
            { error: "Anfrage-ID und Partner-ID sind erforderlich" },
            { status: 400 }
          );
        }

        // Set accepted partner's recipient status
        const { error: acceptError } = await supabase
          .from("inquiry_recipients")
          .update({ status: "accepted" })
          .eq("inquiry_id", id)
          .eq("partner_id", partner_id);

        if (acceptError) {
          return NextResponse.json({ error: acceptError.message }, { status: 500 });
        }

        // Set all other recipients to declined
        const { error: declineError } = await supabase
          .from("inquiry_recipients")
          .update({ status: "declined" })
          .eq("inquiry_id", id)
          .neq("partner_id", partner_id);

        if (declineError) {
          return NextResponse.json({ error: declineError.message }, { status: 500 });
        }

        // Update inquiry status to accepted
        const { error: updateError } = await supabase
          .from("inquiries")
          .update({ status: "accepted" })
          .eq("id", id);

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // Create notification for accepted partner
        const { data: acceptedUsers } = await supabase
          .from("partner_users")
          .select("id")
          .eq("partner_id", partner_id)
          .eq("role", "admin");

        if (acceptedUsers && acceptedUsers.length > 0) {
          const acceptNotifications = acceptedUsers.map((pu) => ({
            recipient_type: "partner_user",
            recipient_id: pu.id,
            type: "inquiry_accepted",
            title: "Anfrage angenommen",
            body: "Ihr Angebot wurde angenommen",
            action_url: `/partner/anfragen/${id}`,
          }));

          await supabase.from("notifications").insert(acceptNotifications);
        }

        // Create decline notifications for other partners
        const { data: otherRecipients } = await supabase
          .from("inquiry_recipients")
          .select("partner_id")
          .eq("inquiry_id", id)
          .neq("partner_id", partner_id);

        if (otherRecipients && otherRecipients.length > 0) {
          const otherPartnerIds = otherRecipients.map((r) => r.partner_id);

          const { data: declinedUsers } = await supabase
            .from("partner_users")
            .select("id")
            .in("partner_id", otherPartnerIds)
            .eq("role", "admin");

          if (declinedUsers && declinedUsers.length > 0) {
            const declineNotifications = declinedUsers.map((pu) => ({
              recipient_type: "partner_user",
              recipient_id: pu.id,
              type: "inquiry_declined",
              title: "Anfrage abgelehnt",
              body: "Ein anderes Angebot wurde bevorzugt",
              action_url: `/partner/anfragen/${id}`,
            }));

            await supabase.from("notifications").insert(declineNotifications);
          }
        }

        // Return updated inquiry
        const { data: inquiry, error: getError } = await supabase
          .from("inquiries")
          .select("*")
          .eq("id", id)
          .single();

        if (getError) {
          return NextResponse.json({ error: getError.message }, { status: 500 });
        }

        return NextResponse.json({ data: inquiry });
      }

      case "decline_all": {
        const { id } = data;

        if (!id) {
          return NextResponse.json({ error: "ID ist erforderlich" }, { status: 400 });
        }

        // Set all recipients to declined
        const { error: declineError } = await supabase
          .from("inquiry_recipients")
          .update({ status: "declined" })
          .eq("inquiry_id", id);

        if (declineError) {
          return NextResponse.json({ error: declineError.message }, { status: 500 });
        }

        // Update inquiry status to declined
        const { error: updateError } = await supabase
          .from("inquiries")
          .update({ status: "declined" })
          .eq("id", id);

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // Create decline notifications for all partners
        const { data: recipients } = await supabase
          .from("inquiry_recipients")
          .select("partner_id")
          .eq("inquiry_id", id);

        if (recipients && recipients.length > 0) {
          const partnerIds = recipients.map((r) => r.partner_id);

          const { data: partnerUsers } = await supabase
            .from("partner_users")
            .select("id")
            .in("partner_id", partnerIds)
            .eq("role", "admin");

          if (partnerUsers && partnerUsers.length > 0) {
            const notifications = partnerUsers.map((pu) => ({
              recipient_type: "partner_user",
              recipient_id: pu.id,
              type: "inquiry_declined",
              title: "Anfrage abgelehnt",
              body: "Die Anfrage wurde abgelehnt",
              action_url: `/partner/anfragen/${id}`,
            }));

            await supabase.from("notifications").insert(notifications);
          }
        }

        // Return updated inquiry
        const { data: inquiry, error: getError } = await supabase
          .from("inquiries")
          .select("*")
          .eq("id", id)
          .single();

        if (getError) {
          return NextResponse.json({ error: getError.message }, { status: 500 });
        }

        return NextResponse.json({ data: inquiry });
      }

      case "close": {
        const { id } = data;

        if (!id) {
          return NextResponse.json({ error: "ID ist erforderlich" }, { status: 400 });
        }

        const { data: inquiry, error } = await supabase
          .from("inquiries")
          .update({ status: "closed" })
          .eq("id", id)
          .select()
          .single();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: inquiry });
      }

      case "send_message": {
        const { id, message, attachments } = data;

        if (!id || !message) {
          return NextResponse.json(
            { error: "Anfrage-ID und Nachricht sind erforderlich" },
            { status: 400 }
          );
        }

        const insertData: Record<string, unknown> = {
          inquiry_id: id,
          sender_type: "staff",
          sender_id: user.id,
          sender_name: profile.display_name || "Mitarbeiter",
          message,
        };

        if (attachments !== undefined) insertData.attachments = attachments;

        const { data: msg, error } = await supabase
          .from("inquiry_messages")
          .insert(insertData)
          .select()
          .single();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
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
