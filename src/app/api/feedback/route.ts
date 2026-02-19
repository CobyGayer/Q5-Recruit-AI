import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "Q5 Recruit AI <onboarding@resend.dev>";
const FEEDBACK_RECIPIENT = "coby.gayer@gmail.com";
const MAX_MESSAGE_LENGTH = 2000;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!message) {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 }
    );
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or less` },
      { status: 400 }
    );
  }

  try {
    const { error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: FEEDBACK_RECIPIENT,
      subject: "Q5 Recruit AI Feedback",
      text: `Feedback from: ${user.email}\n\n${message}`,
    });

    if (sendError) {
      console.error("Resend API error:", sendError);
      return NextResponse.json(
        { error: "Failed to send feedback. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send feedback email:", error);
    return NextResponse.json(
      { error: "Failed to send feedback. Please try again." },
      { status: 500 }
    );
  }
}
