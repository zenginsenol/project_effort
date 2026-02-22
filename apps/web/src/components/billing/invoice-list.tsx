'use client';

import { FileText, Download, ExternalLink, AlertCircle } from 'lucide-react';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

interface InvoiceListProps {
  className?: string;
}

type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

function getStatusColor(status: InvoiceStatus): string {
  switch (status) {
    case 'paid':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'open':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'draft':
      return 'text-gray-600 bg-gray-50 border-gray-200';
    case 'void':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'uncollectible':
      return 'text-orange-600 bg-orange-50 border-orange-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

function formatCurrency(amount: string | null, currency: string | null): string {
  if (!amount) return '$0.00';
  const numericAmount = parseFloat(amount);
  const currencyCode = currency?.toUpperCase() ?? 'USD';

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
    }).format(numericAmount);
  } catch {
    // Fallback if currency code is invalid
    return `${currencyCode} ${numericAmount.toFixed(2)}`;
  }
}

function formatDate(date: Date | null): string {
  if (!date) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function InvoiceList({ className }: InvoiceListProps): React.ReactElement {
  const { data: invoices, isLoading, isError, error } = trpc.billing.listInvoices.useQuery({ limit: 10 });

  if (isLoading) {
    return (
      <div className={cn('rounded-lg border bg-card p-6', className)}>
        <h2 className="mb-4 text-lg font-semibold">Invoice History</h2>
        <div className="space-y-3">
          <div className="h-20 w-full animate-pulse rounded bg-muted" />
          <div className="h-20 w-full animate-pulse rounded bg-muted" />
          <div className="h-20 w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn('rounded-lg border bg-card p-6', className)}>
        <h2 className="mb-4 text-lg font-semibold">Invoice History</h2>
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="flex-1">
              <p className="font-medium text-red-900">Failed to load invoices</p>
              <p className="mt-1 text-sm text-red-700">
                {error?.message ?? 'Please try again later.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasInvoices = invoices && invoices.length > 0;

  return (
    <div className={cn('rounded-lg border bg-card p-6', className)}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Invoice History</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            View and download your past invoices
          </p>
        </div>
        <FileText className="h-6 w-6 text-muted-foreground" />
      </div>

      {hasInvoices ? (
        <div className="space-y-3">
          {invoices.map((invoice) => {
            const statusColor = getStatusColor(invoice.status as InvoiceStatus);
            const amount = formatCurrency(invoice.amountPaid, invoice.currency);
            const date = formatDate(invoice.createdAt);
            const hasPdf = Boolean(invoice.invoicePdf);
            const hasHostedUrl = Boolean(invoice.hostedInvoiceUrl);

            return (
              <div
                key={invoice.id}
                className="flex items-center justify-between rounded-lg border bg-muted/30 p-4 transition-colors hover:bg-muted/50"
              >
                {/* Invoice Info */}
                <div className="flex flex-1 items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{date}</p>
                      <span
                        className={cn(
                          'rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize',
                          statusColor,
                        )}
                      >
                        {invoice.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Amount: <span className="font-medium text-foreground">{amount}</span>
                      {invoice.billingPeriodStart && invoice.billingPeriodEnd && (
                        <span className="ml-2">
                          • {formatDate(invoice.billingPeriodStart)} - {formatDate(invoice.billingPeriodEnd)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Download Actions */}
                <div className="flex items-center gap-2">
                  {hasPdf && (
                    <a
                      href={invoice.invoicePdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                    >
                      <Download className="h-3.5 w-3.5" />
                      PDF
                    </a>
                  )}
                  {hasHostedUrl && (
                    <a
                      href={invoice.hostedInvoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                      title="View invoice details"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View
                    </a>
                  )}
                  {!hasPdf && !hasHostedUrl && (
                    <span className="text-xs text-muted-foreground">No links available</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border bg-muted/50 p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium">No invoices yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your invoice history will appear here once you have an active subscription
          </p>
        </div>
      )}

      {/* Info Text */}
      {hasInvoices && (
        <div className="mt-6 rounded-md bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground">
            Invoices are generated automatically for your subscription. You can download PDF copies
            or view detailed invoice information by clicking the respective buttons.
          </p>
        </div>
      )}
    </div>
  );
}
