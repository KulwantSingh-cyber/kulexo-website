type ResendEmail = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
};

export async function sendResendEmail(apiKey: string, email: ResendEmail) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: ["Bearer", apiKey].join(" "),
      "content-type": "application/json"
    },
    body: JSON.stringify(email)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend rejected the email request (${response.status}): ${detail}`);
  }
}
