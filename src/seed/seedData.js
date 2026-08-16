const emailTemplates = [
  {
    key: 'new_ticket_confirmation',
    name: 'Support Ticket Request Acknowledgment',
    description: 'Sent to the customer when a new ticket is created to confirm it was received.',
    subject: '[#%{ticket.number}] %{ticket.subject}',
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
    trigger: 'new_ticket_confirmation',
    recipient: 'user',
    isActive: true,
    context: 'ticket',
  },
  {
    key: 'new_ticket_alert',
    name: 'New Ticket Alert',
    description: 'Sent to the assigned department staff when a new ticket arrives.',
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
    trigger: 'new_ticket_alert',
    recipient: 'staff',
    isActive: true,
    context: 'ticket',
  },
  {
    key: 'new_reply_alert',
    name: 'New Reply Alert',
    description: 'Sent to the assigned agent when the customer posts a new reply on a ticket.',
    subject: '[#%{ticket.number}] New Reply: %{ticket.subject}',
    body: `Hi %{recipient.name},

%{user.name} replied to ticket #%{ticket.number}.

Subject: %{ticket.subject}

To view or respond, please visit:
%{urls.agent}`,
    trigger: 'new_reply_alert',
    recipient: 'agent',
    isActive: true,
    context: 'ticket',
  },
  {
    key: 'ticket_response',
    name: 'Ticket Response',
    description: 'Sent to the customer when a staff member responds to their ticket.',
    subject: 'Re: %{ticket.subject}',
    body: `Dear %{user.name},

%{agent.name} has responded to your ticket #%{ticket.number}.

Subject: %{ticket.subject}
Status: %{ticket.status}

To view the full thread and post a follow-up, please visit:
%{urls.ticket}

Regards,
%{company.name}`,
    trigger: 'ticket_response',
    recipient: 'user',
    isActive: true,
    context: 'ticket',
  },
  {
    key: 'ticket_assigned',
    name: 'Ticket Assignment Notice',
    description: 'Sent to the agent when a ticket is assigned to them.',
    subject: '[#%{ticket.number}] Ticket Assigned',
    body: `Hi %{recipient.name},

Ticket #%{ticket.number} has been assigned to you.

Subject: %{ticket.subject}
User: %{user.name} (%{user.email})

Please review and respond as soon as possible.
%{urls.agent}`,
    trigger: 'ticket_assigned',
    recipient: 'agent',
    isActive: true,
    context: 'ticket',
  },
  {
    key: 'ticket_closed',
    name: 'Ticket Closed',
    description: 'Sent to the customer when their ticket is closed.',
    subject: 'Re: %{ticket.subject} [closed]',
    body: `Dear %{user.name},

This message is to notify you that ticket #%{ticket.number} has been closed by the support team.

Subject: %{ticket.subject}

If you believe this ticket was closed in error, or you would like to reopen it, please respond to this email or visit:
%{urls.ticket}

Thank you for contacting %{company.name}.

Regards,
%{company.name}`,
    trigger: 'ticket_closed',
    recipient: 'user',
    isActive: true,
    context: 'ticket',
  },
  {
    key: 'welcome_user',
    name: 'Welcome New User',
    description: 'Sent to a customer when their account is created on the portal.',
    subject: 'Welcome to the Support Center',
    body: `Dear %{user.name},

Welcome to the %{company.name} Support Center. Your account has been created successfully.

You can now open new tickets, check ticket status and browse our knowledgebase.

Visit: %{urls.home}

Regards,
%{company.name}`,
    trigger: 'welcome_user',
    recipient: 'user',
    isActive: true,
    context: 'account',
  },
  {
    key: 'employee_welcome',
    name: 'Employee Account Created',
    description: 'Sent to an employee when their portal account is created by an admin.',
    subject: 'Your support portal account has been created',
    body: `Dear %{user.name},

An employee account has been created for you on the %{company.name} portal by %{createdBy.name}.

Login: %{urls.login}
Email: %{account.email}
Password: %{account.password}

Please sign in and change your password after your first login.

Regards,
%{company.name}`,
    trigger: 'employee_welcome',
    recipient: 'user',
    isActive: true,
    context: 'account',
  },
  {
    key: 'password_reset',
    name: 'Password Reset',
    description: 'Sent to a user when they request a password reset link.',
    subject: 'Password Reset Request',
    body: `Dear %{user.name},

We received a request to reset your password.

To reset your password, please click the link below:
%{urls.reset}

This link will expire in 30 minutes. If you did not request this, please ignore this email.

Regards,
%{company.name}`,
    trigger: 'password_reset',
    recipient: 'user',
    isActive: true,
    context: 'account',
  },
  {
    key: 'admin_welcome',
    name: 'Company Admin Account Created',
    description: 'Sent to the admin when their company is registered on the platform.',
    subject: 'Your Administrator account has been created',
    body: `Dear %{user.name},

Your company "%{company.name}" has been registered and an administrator account has been created for you.

Login: %{urls.login}
Email: %{account.email}
Password: %{account.password}

Please sign in to the Administrator Panel and change your password after your first login.

Regards,
%{company.name}`,
    trigger: 'admin_welcome',
    recipient: 'admin',
    isActive: true,
    context: 'account',
  },
  {
    key: 'company_admin_created',
    name: 'Company Registered with Admin Credentials',
    description: 'Sent to the registered email when a company is created on the platform.',
    subject: 'Your company is ready',
    body: `Dear Administrator,

Your company "%{company.name}" has been registered on the support platform. Your administrator login details are below:

Login: %{urls.login}
Email: %{account.email}
Password: %{account.password}

Please keep these credentials safe and change your password after the first login.

Regards,
%{company.name}`,
    trigger: 'company_admin_created',
    recipient: 'admin',
    isActive: true,
    context: 'account',
  },
  // ---- Enterprise: communication automation ----
  {
    key: 'sla_warning',
    name: 'SLA Warning',
    description: 'Sent to the assigned agent when a ticket is at risk of breaching its SLA.',
    subject: 'SLA at risk: %{ticket.number} — %{ticket.subject}',
    body: `Dear %{recipient.name},

Ticket %{ticket.number} (%{ticket.subject}) is at risk of breaching its SLA. The due time is %{ticket.due}.

Please review this ticket as soon as possible.

View ticket: %{urls.agent}

Regards,
%{company.name}`,
    trigger: 'sla_warning',
    recipient: 'agent',
    isActive: true,
    context: 'alert',
  },
  {
    key: 'sla_breach',
    name: 'SLA Breached',
    description: 'Sent when a ticket has breached its SLA target.',
    subject: 'SLA BREACHED: %{ticket.number} — %{ticket.subject}',
    body: `Dear %{recipient.name},

Ticket %{ticket.number} (%{ticket.subject}) has breached its SLA. Due time was %{ticket.due}.

Immediate attention is required.

View ticket: %{urls.agent}

Regards,
%{company.name}`,
    trigger: 'sla_breach',
    recipient: 'agent',
    isActive: true,
    context: 'alert',
  },
  {
    key: 'waiting_for_customer',
    name: 'Waiting for Customer',
    description: 'Sent to the customer when a ticket is waiting on their input.',
    subject: 'We need more information on %{ticket.number}',
    body: `Dear %{user.name},

Regarding ticket %{ticket.number}, we need a little more information from you before we can continue.

Please reply to this email or visit %{urls.ticket} to add the details.

Regards,
%{company.name}`,
    trigger: 'waiting_for_customer',
    recipient: 'user',
    isActive: true,
    context: 'alert',
  },
  {
    key: 'csat_survey',
    name: 'CSAT Survey',
    description: 'Sent after ticket resolution asking for a satisfaction rating.',
    subject: 'How did we do? Rate your %{ticket.number} experience',
    body: `Dear %{user.name},

Your ticket %{ticket.number} has been resolved. We would love to hear how we did.

Rate your experience (1-5): %{urls.ticket}?csat=1

Regards,
%{company.name}`,
    trigger: 'csat_survey',
    recipient: 'user',
    isActive: true,
    context: 'survey',
  },
  {
    key: 'incident_created',
    name: 'Service Incident Notification',
    description: 'Sent to customers during a major incident (proactive support).',
    subject: 'Service update: %{incident.title}',
    body: `Dear %{user.name},

We are currently investigating an incident affecting our services.

%{incident.title}

%{incident.body}

Please track live status at: %{urls.home}/status

We apologize for any inconvenience.

Regards,
%{company.name}`,
    trigger: 'incident_created',
    recipient: 'user',
    isActive: true,
    context: 'alert',
  },
  {
    key: 'contract_expiring',
    name: 'Contract Expiring',
    description: 'Sent to the account manager when a contract is close to renewal.',
    subject: 'Contract renewal: %{contract.name} expires soon',
    body: `Dear %{recipient.name},

The contract "%{contract.name}" for %{organization.name} expires on %{contract.endDate}.

Please review the renewal options.

Regards,
%{company.name}`,
    trigger: 'contract_expiring',
    recipient: 'agent',
    isActive: true,
    context: 'billing',
  },
  {
    key: 'notification',
    name: 'Agent Notification',
    description: 'Sent to agents when an in-app notification event occurs and email notifications are enabled.',
    subject: 'osTicket: %{notification.type}',
    body: `Hi %{agent.name},

%{notification.message}

%{notification.link ? ('View details: ' + notification.link) : ''}`,
    trigger: 'notification',
    recipient: 'agent',
    isActive: true,
    context: 'notification',
  },
];

const defaultPriorities = [
  { name: 'Low', level: 1, color: '#16a34a', isDefault: false, isActive: true },
  { name: 'Normal', level: 2, color: '#64748b', isDefault: true, isActive: true },
  { name: 'High', level: 3, color: '#d97706', isDefault: false, isActive: true },
  { name: 'Emergency', level: 4, color: '#dc2626', isDefault: false, isActive: true },
];

module.exports = { emailTemplates, defaultPriorities };
