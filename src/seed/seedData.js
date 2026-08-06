const emailTemplates = [
  {
    key: 'new_ticket_confirmation',
    name: 'Support Ticket Request Acknowledgment',
    subject: 'Support Ticket Request Acknowledgment',
    body: `Dear %{user.name},

Your support request has been received and a ticket has been created.

A Support Representative will be reviewing your request and will respond to you shortly.

Thank you for your patience.

Name: %{user.name}
Subject: %{ticket.subject}
Department: %{dept.name}
Topic: %{topic.name}
Priority: %{ticket.priority}
Status: %{ticket.status}
Created: %{ticket.created}

To view the status of the ticket, please visit:
%{urls.ticket}

Alternatively, you can simply reply to this email to post a message on the ticket.

Regards,
%{company.name}`,
    context: 'ticket',
  },
  {
    key: 'new_ticket_alert',
    name: 'New Ticket Alert',
    subject: '[#%{ticket.number}] New Ticket: %{ticket.subject}',
    body: `Hi %{recipient.name},

A new ticket has been created.

Name: %{user.name}
Email: %{user.email}
Subject: %{ticket.subject}
Priority: %{ticket.priority}
Department: %{dept.name}

To view or respond to the ticket, please visit:
%{urls.agent}

Thank you.`,
    context: 'ticket',
  },
  {
    key: 'new_reply_alert',
    name: 'New Reply Alert',
    subject: '[#%{ticket.number}] New Reply: %{ticket.subject}',
    body: `Hi %{recipient.name},

%{user.name} replied to ticket #%{ticket.number}.

Subject: %{ticket.subject}

To view or respond, please visit:
%{urls.agent}`,
    context: 'ticket',
  },
  {
    key: 'ticket_response',
    name: 'Ticket Response',
    subject: 'Re: %{ticket.subject}',
    body: `Dear %{user.name},

%{agent.name} has responded to your ticket #%{ticket.number}.

Subject: %{ticket.subject}
Status: %{ticket.status}

To view the full thread and post a follow-up, please visit:
%{urls.ticket}

Regards,
%{company.name}`,
    context: 'ticket',
  },
  {
    key: 'ticket_assigned',
    name: 'Ticket Assignment Notice',
    subject: '[#%{ticket.number}] Ticket Assigned',
    body: `Hi %{recipient.name},

Ticket #%{ticket.number} has been assigned to you.

Subject: %{ticket.subject}
User: %{user.name} (%{user.email})

Please review and respond as soon as possible.
%{urls.agent}`,
    context: 'ticket',
  },
  {
    key: 'ticket_closed',
    name: 'Ticket Closed',
    subject: 'Re: %{ticket.subject} [closed]',
    body: `Dear %{user.name},

This message is to notify you that ticket #%{ticket.number} has been closed by the support team.

Subject: %{ticket.subject}

If you believe this ticket was closed in error, or you would like to reopen it, please respond to this email or visit:
%{urls.ticket}

Thank you for contacting %{company.name}.

Regards,
%{company.name}`,
    context: 'ticket',
  },
  {
    key: 'welcome_user',
    name: 'Welcome New User',
    subject: 'Welcome to the Support Center',
    body: `Dear %{user.name},

Welcome to the %{company.name} Support Center. Your account has been created successfully.

You can now open new tickets, check ticket status and browse our knowledgebase.

Visit: %{urls.home}

Regards,
%{company.name}`,
    context: 'account',
  },
  {
    key: 'password_reset',
    name: 'Password Reset',
    subject: 'Password Reset Request',
    body: `Dear %{user.name},

We received a request to reset your password.

To reset your password, please click the link below:
%{urls.reset}

This link will expire in 30 minutes. If you did not request this, please ignore this email.

Regards,
%{company.name}`,
    context: 'account',
  },
];

module.exports = { emailTemplates };
