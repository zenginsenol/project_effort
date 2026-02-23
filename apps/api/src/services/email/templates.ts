/**
 * Email templates for EstimatePro
 * Provides branded HTML and plain text email templates
 */

export interface InvitationEmailTemplateParams {
  inviterName: string;
  organizationName: string;
  invitationUrl: string;
  role: string;
}

export interface EmailTemplate {
  html: string;
  text: string;
}

/**
 * Generate team invitation email template
 * Returns both HTML and plain text versions
 */
export function invitationEmailTemplate(params: InvitationEmailTemplateParams): EmailTemplate {
  const currentYear = new Date().getFullYear();

  const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You've been invited to ${params.organizationName}</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <tr>
              <td style="padding: 40px;">
                <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 600; color: #1a1a1a;">
                  You've been invited to join ${params.organizationName}
                </h1>
                <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #4a4a4a;">
                  ${params.inviterName} has invited you to join <strong>${params.organizationName}</strong> on EstimatePro as a <strong>${params.role}</strong>.
                </p>
                <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #4a4a4a;">
                  EstimatePro helps teams estimate project effort with AI-powered suggestions and collaborative planning poker sessions.
                </p>
                <table cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
                  <tr>
                    <td style="background-color: #2563eb; border-radius: 6px; text-align: center;">
                      <a href="${params.invitationUrl}" style="display: inline-block; padding: 12px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                        Accept Invitation
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin: 0 0 8px 0; font-size: 14px; line-height: 20px; color: #6b6b6b;">
                  If the button doesn't work, copy and paste this link into your browser:
                </p>
                <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 20px; color: #2563eb; word-break: break-all;">
                  ${params.invitationUrl}
                </p>
                <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
                <p style="margin: 0; font-size: 12px; line-height: 18px; color: #9b9b9b;">
                  This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
          <table width="600" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
            <tr>
              <td align="center" style="padding: 0 40px;">
                <p style="margin: 0; font-size: 12px; line-height: 18px; color: #9b9b9b;">
                  &copy; ${currentYear} EstimatePro. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();

  const text = `
You've been invited to join ${params.organizationName}

${params.inviterName} has invited you to join ${params.organizationName} on EstimatePro as a ${params.role}.

EstimatePro helps teams estimate project effort with AI-powered suggestions and collaborative planning poker sessions.

Accept your invitation by visiting:
${params.invitationUrl}

This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.

© ${currentYear} EstimatePro. All rights reserved.
  `.trim();

  return { html, text };
}
