import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional
from app.config import settings

logger = logging.getLogger("email_service")


def get_base_html_template(title: str, preheader: str, body_html: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }}
    .container {{
      max-width: 600px;
      margin: 30px auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }}
    .header {{
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
      padding: 32px 24px;
      text-align: center;
      color: #ffffff;
    }}
    .header h1 {{
      margin: 0;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }}
    .header p {{
      margin: 6px 0 0 0;
      font-size: 13px;
      color: #c7d2fe;
    }}
    .content {{
      padding: 32px 24px;
      line-height: 1.6;
      font-size: 14px;
    }}
    .badge {{
      display: inline-block;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 9999px;
      background-color: #e0e7ff;
      color: #3730a3;
    }}
    .card {{
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px;
      margin: 20px 0;
    }}
    .card-row {{
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px dashed #e2e8f0;
      font-size: 13px;
    }}
    .card-row:last-child {{
      border-bottom: none;
    }}
    .card-label {{
      color: #64748b;
      font-weight: 500;
    }}
    .card-value {{
      color: #0f172a;
      font-weight: 700;
    }}
    .btn {{
      display: inline-block;
      background-color: #4338ca;
      color: #ffffff !important;
      font-weight: 600;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 8px;
      margin-top: 16px;
      font-size: 13px;
    }}
    .footer {{
      background-color: #f1f5f9;
      padding: 20px 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }}
  </style>
</head>
<body>
  <div style="display: none; max-height: 0px; overflow: hidden;">
    {preheader}
  </div>
  <div class="container">
    <div class="header">
      <h1>VNDLY WORKFORCE</h1>
      <p>Contingent Workforce & Staffing Management</p>
    </div>
    <div class="content">
      {body_html}
    </div>
    <div class="footer">
      <p style="margin: 0;">This is an automated notification from VNDLY Contingent Workforce Platform.</p>
      <p style="margin: 4px 0 0 0;">Please log in to your dashboard to manage your assignments, timesheets, and pay stubs.</p>
    </div>
  </div>
</body>
</html>
"""


def send_email(to_email: str, subject: str, html_body: str, plain_body: Optional[str] = None) -> bool:
    """
    Sends an email using standard SMTP.
    If SMTP_ENABLED is False or credentials are not configured,
    gracefully outputs formatted preview to logs.
    """
    if not to_email:
        return False

    if not settings.SMTP_ENABLED or not settings.SMTP_HOST:
        print(f"\n📧 [EMAIL DISPATCH (DEV MODE)]\nTo: {to_email}\nSubject: {subject}\n--- Email Body Preview ---\n{plain_body or subject}\n")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = to_email

        if plain_body:
            msg.attach(MIMEText(plain_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())

        logger.info(f"Email successfully delivered to {to_email} with subject: '{subject}'")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        print(f"⚠️ Email dispatch warning to {to_email}: {e}")
        return False


# ---------------------------------------------------------------------------
# Pre-built HTML Email Senders
# ---------------------------------------------------------------------------

def send_assignment_email(
    contractor_email: str,
    contractor_name: str,
    project_name: str,
    role: str,
    pay_rate: float,
    currency: str,
    start_date: str,
    vendor_name: str,
):
    subject = f"🚀 New Project Assignment: {project_name}"
    preheader = f"You have been assigned to {project_name} as {role}."
    
    body = f"""
      <p>Hello <strong>{contractor_name}</strong>,</p>
      <p>Congratulations! You have been assigned to a new project by your managing agency, <strong>{vendor_name}</strong>.</p>
      
      <div class="card">
        <div class="card-row">
          <span class="card-label">Project:</span>
          <span class="card-value">{project_name}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Role:</span>
          <span class="card-value">{role}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Pay Rate:</span>
          <span class="card-value">{currency} {pay_rate:,.2f} / hour</span>
        </div>
        <div class="card-row">
          <span class="card-label">Start Date:</span>
          <span class="card-value">{start_date}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Managing Vendor:</span>
          <span class="card-value">{vendor_name}</span>
        </div>
      </div>
      
      <p>Please log in to your contractor portal to review your project details and begin logging weekly timesheets.</p>
      <p style="text-align: center;">
        <a href="http://localhost:5173/contractor/assignment" class="btn">View My Assignment →</a>
      </p>
    """
    html = get_base_html_template(subject, preheader, body)
    return send_email(contractor_email, subject, html, f"Hi {contractor_name}, you have been assigned to {project_name} as {role}. Pay rate: {currency} {pay_rate}/hr.")


def send_timesheet_review_email(
    contractor_email: str,
    contractor_name: str,
    week_period: str,
    status: str,
    total_hours: float,
    compensation: float,
    currency: str,
    vendor_comment: Optional[str] = None,
):
    if status == "APPROVED":
        subject = f"✓ Timesheet Approved: Week of {week_period}"
        preheader = f"Your timesheet for {week_period} has been approved."
        status_badge = '<span class="badge" style="background-color: #ecfdf5; color: #047857;">✓ Approved & Locked</span>'
        comment_block = f"<p><strong>Vendor Note:</strong> {vendor_comment}</p>" if vendor_comment else ""
    else:
        subject = f"⚠️ Timesheet Revision Requested: Week of {week_period}"
        preheader = f"Your vendor requested a revision on your timesheet for {week_period}."
        status_badge = '<span class="badge" style="background-color: #fff1f2; color: #be123c;">⚠️ Revision Needed</span>'
        comment_block = f"""
          <div class="card" style="border-left: 4px solid #e11d48;">
            <p style="margin: 0; font-weight: 700; color: #9f1239;">Vendor Feedback:</p>
            <p style="margin: 4px 0 0 0; color: #4c0519;">{vendor_comment or 'Please review your logged hours and re-submit.'}</p>
          </div>
        """

    body = f"""
      <p>Hello <strong>{contractor_name}</strong>,</p>
      <p>Your weekly timesheet has been reviewed by your vendor manager.</p>
      
      <div style="margin: 16px 0;">{status_badge}</div>

      <div class="card">
        <div class="card-row">
          <span class="card-label">Weekly Period:</span>
          <span class="card-value">{week_period}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Hours Logged:</span>
          <span class="card-value">{total_hours:.1f} hrs</span>
        </div>
        <div class="card-row">
          <span class="card-label">Approved Pay:</span>
          <span class="card-value">{currency} {compensation:,.2f}</span>
        </div>
      </div>
      
      {comment_block}
      
      <p style="text-align: center;">
        <a href="http://localhost:5173/contractor/timesheets" class="btn">View Timesheets →</a>
      </p>
    """
    html = get_base_html_template(subject, preheader, body)
    return send_email(contractor_email, subject, html, f"Hi {contractor_name}, your timesheet for {week_period} status is: {status}.")


def send_pay_slip_email(
    contractor_email: str,
    contractor_name: str,
    period: str,
    gross_pay: float,
    tax_withheld: float,
    net_payout: float,
    currency: str,
    bank_reference: Optional[str] = None,
):
    subject = f"💳 Wage Disbursement Confirmation: {currency} {net_payout:,.2f}"
    preheader = f"Your wage disbursement for {period} has been processed."

    body = f"""
      <p>Hello <strong>{contractor_name}</strong>,</p>
      <p>Great news! Your wage payout for the pay period <strong>{period}</strong> has been disbursed via direct bank transfer.</p>
      
      <div class="card">
        <div class="card-row">
          <span class="card-label">Pay Period:</span>
          <span class="card-value">{period}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Gross Wages:</span>
          <span class="card-value">{currency} {gross_pay:,.2f}</span>
        </div>
        <div class="card-row">
          <span class="card-label">TDS Tax Withheld (10%):</span>
          <span class="card-value" style="color: #e11d48;">-{currency} {tax_withheld:,.2f}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Net Take-Home Pay:</span>
          <span class="card-value" style="color: #047857; font-size: 15px;">{currency} {net_payout:,.2f}</span>
        </div>
        {f'<div class="card-row"><span class="card-label">Bank Ref / UTR:</span><span class="card-value" style="font-family: monospace;">{bank_reference}</span></div>' if bank_reference else ''}
      </div>
      
      <p>You can download your official Pay Stub PDF statement directly from your portal.</p>
      <p style="text-align: center;">
        <a href="http://localhost:5173/contractor/payroll" class="btn">View & Download Pay Stub →</a>
      </p>
    """
    html = get_base_html_template(subject, preheader, body)
    return send_email(contractor_email, subject, html, f"Hi {contractor_name}, your payout of {currency} {net_payout} for {period} has been disbursed.")


def send_invoice_issued_email(
    client_email: str,
    client_name: str,
    invoice_number: str,
    billing_period: str,
    total_amount: float,
    currency: str,
    due_date: str,
    vendor_name: str,
):
    subject = f"🧾 Tax Invoice {invoice_number} from {vendor_name}"
    preheader = f"Invoice {invoice_number} for {currency} {total_amount:,.2f} is due on {due_date}."

    body = f"""
      <p>Dear <strong>{client_name}</strong> Accounts Payable,</p>
      <p>Please find the billing statement for contingent workforce services provided by <strong>{vendor_name}</strong> for the period <strong>{billing_period}</strong>.</p>
      
      <div class="card">
        <div class="card-row">
          <span class="card-label">Invoice Number:</span>
          <span class="card-value" style="font-family: monospace;">{invoice_number}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Billing Cycle:</span>
          <span class="card-value">{billing_period}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Due Date:</span>
          <span class="card-value" style="color: #e11d48;">{due_date}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Total Amount Due (incl. 18% GST):</span>
          <span class="card-value" style="color: #3730a3; font-size: 15px;">{currency} {total_amount:,.2f}</span>
        </div>
      </div>
      
      <p>Please remit payment via wire transfer according to the bank details specified in your service contract.</p>
    """
    html = get_base_html_template(subject, preheader, body)
    return send_email(client_email, subject, html, f"Dear {client_name}, invoice {invoice_number} for {currency} {total_amount} is due on {due_date}.")
