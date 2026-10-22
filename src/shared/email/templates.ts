export function renderTemplate(
  template: string,
  variables: Record<string, unknown>,
): string {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_match, key: string) => {
    const value = key.split(".").reduce<unknown>((acc, part) => {
      if (acc && typeof acc === "object")
        return (acc as Record<string, unknown>)[part];
      return undefined;
    }, variables);
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
            <tr><td style="background:#111827;padding:20px 32px;color:#ffffff;font-size:18px;font-weight:600;">ITSM SaaS Platform</td></tr>
            <tr><td style="padding:32px;">${bodyHtml}</td></tr>
            <tr><td style="padding:20px 32px;background:#f9fafb;color:#6b7280;font-size:12px;">This is an automated message from the ITSM SaaS platform.</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(url: string, label: string): string {
  return `<p style="text-align:center;margin:28px 0;"><a href="${url}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;display:inline-block;">${label}</a></p>`;
}

export const emailTemplates = {
  passwordReset(input: {
    name: string;
    resetUrl: string;
    expiresMinutes: number;
  }): { subject: string; html: string; text: string } {
    const subject = "Reset your ITSM platform password";
    const html = layout(
      subject,
      `<p>Hello ${input.name},</p>
       <p>We received a request to reset your platform password. This link expires in ${input.expiresMinutes} minutes.</p>
       ${button(input.resetUrl, "Reset password")}
       <p>If you did not request this change, you can safely ignore this email and your password will remain unchanged.</p>`,
    );
    return {
      subject,
      html,
      text: `Hello ${input.name}, reset your password using this link (expires in ${input.expiresMinutes} minutes): ${input.resetUrl}`,
    };
  },

  invitation(input: { name: string; invitedBy: string; acceptUrl: string }): {
    subject: string;
    html: string;
    text: string;
  } {
    const subject = "You have been invited to the ITSM platform";
    const html = layout(
      subject,
      `<p>Hello ${input.name},</p>
       <p>${input.invitedBy} invited you to join the platform as an internal staff member.</p>
       ${button(input.acceptUrl, "Accept invitation")}
       <p>If you were not expecting this invitation, you can ignore this email.</p>`,
    );
    return {
      subject,
      html,
      text: `Hello ${input.name}, ${input.invitedBy} invited you to the ITSM platform. Accept here: ${input.acceptUrl}`,
    };
  },

  emailChange(input: { name: string; newEmail: string; confirmUrl: string }): {
    subject: string;
    html: string;
    text: string;
  } {
    const subject = "Confirm your new email address";
    const html = layout(
      subject,
      `<p>Hello ${input.name},</p>
       <p>Confirm that you want to change your platform email address to <strong>${input.newEmail}</strong>.</p>
       ${button(input.confirmUrl, "Confirm email change")}
       <p>If you did not request this change, please contact your platform administrator immediately.</p>`,
    );
    return {
      subject,
      html,
      text: `Confirm the email change to ${input.newEmail}: ${input.confirmUrl}`,
    };
  },

  mfaChanged(input: { name: string; enabled: boolean }): {
    subject: string;
    html: string;
    text: string;
  } {
    const subject = input.enabled
      ? "Multi-factor authentication enabled"
      : "Multi-factor authentication disabled";
    const html = layout(
      subject,
      `<p>Hello ${input.name},</p>
       <p>Multi-factor authentication was <strong>${input.enabled ? "enabled" : "disabled"}</strong> on your account.</p>
       <p>If you did not make this change, contact your platform administrator immediately.</p>`,
    );
    return {
      subject,
      html,
      text: `MFA was ${input.enabled ? "enabled" : "disabled"} on your account.`,
    };
  },

  testMessage(input: { providerName: string }): {
    subject: string;
    html: string;
    text: string;
  } {
    const subject = `Test email from ${input.providerName}`;
    const html = layout(
      subject,
      `<p>This is a test message confirming that the <strong>${input.providerName}</strong> email provider is configured correctly.</p>`,
    );
    return { subject, html, text: `Test email from ${input.providerName}.` };
  },
};
