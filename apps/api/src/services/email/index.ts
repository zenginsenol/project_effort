/**
 * Email service index
 * Provides a unified API for sending emails via Resend
 */

import { resendEmailService } from './resend';
import { invitationEmailTemplate } from './templates';
import type {
  SendEmailParams,
  SendEmailResult,
  TeamInvitationEmailParams,
} from './resend';
import type { InvitationEmailTemplateParams } from './templates';

export type { SendEmailParams, SendEmailResult, TeamInvitationEmailParams, InvitationEmailTemplateParams };

/**
 * Send a team invitation email
 * Combines the email service with the invitation template
 */
export async function sendInvitationEmail(params: InvitationEmailTemplateParams & { to: string }): Promise<SendEmailResult> {
  const { to, ...templateParams } = params;
  const { html, text } = invitationEmailTemplate(templateParams);

  return resendEmailService.sendEmail({
    to,
    subject: `You've been invited to join ${templateParams.organizationName} on EstimatePro`,
    html,
    text,
  });
}

/**
 * Export the email service instance for advanced usage
 */
export { resendEmailService };

/**
 * Export template functions for custom email generation
 */
export { invitationEmailTemplate };
