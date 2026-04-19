import { useEffect, useState } from 'react';
import api from '../lib/api';

type Tab = 'gl' | 'ar' | 'ap' | 'tax' | 'period' | 'reports';

export default function AccountingPage() {
  const [tab, setTab] = useState<Tab>('gl');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [trialBalance, setTrialBalance] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [taxReturns, setTaxReturns] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [reports, setReports] = useState<any>({});
  const [loading, setLoading] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [a, tb, c, i, v, b, t, tr, p, pnl, bs, cf] = await Promise.all([
        api.get('/accounting/accounts'),
        api.get('/accounting/trial-balance'),
        api.get('/accounting/ar/customers'),
        api.get('/accounting/ar/invoices'),
        api.get('/accounting/ap/vendors'),
        api.get('/accounting/ap/bills'),
        api.get('/accounting/tax/rates'),
        api.get('/accounting/tax/returns'),
        api.get('/accounting/periods'),
        api.get('/accounting/reports/pnl'),
        api.get('/accounting/reports/balance-sheet'),
        api.get('/accounting/reports/cashflow'),
      ]);
      setAccounts(a.data?.data || []);
      setTrialBalance(tb.data?.data || []);
      setCustomers(c.data?.data || []);
      setInvoices(i.data?.data || []);
      setVendors(v.data?.data || []);
      setBills(b.data?.data || []);
      setTaxRates(t.data?.data || []);
      setTaxReturns(tr.data?.data || []);
      setPeriods(p.data?.data || []);
      setReports({ pnl: pnl.data?.data, bs: bs.data?.data, cf: cf.data?.data });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'gl', label: 'General Ledger' },
    { id: 'ar', label: 'Accounts Receivable' },
    { id: 'ap', label: 'Accounts Payable' },
    { id: 'tax', label: 'Tax Management' },
    { id: 'period', label: 'Period Close' },
    { id: 'reports', label: 'Financial Statements' },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Accounting Package</h1>
            <p className="text-sm text-slate-500">GL, AR, AP, Tax, Period close, and statements.</p>
          </div>
          <button onClick={() => void loadAll()} className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${tab === t.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {tab === 'gl' && (
        <section className="grid gap-4 lg:grid-cols-2">
          <Card title="Chart of Accounts" subtitle={`${accounts.length} accounts`}>
            <SimpleTable
              headers={['Code', 'Name', 'Type', 'Sub Type']}
              rows={accounts.slice(0, 20).map((a) => [a.code, a.name, a.accountType, a.subType || '—'])}
            />
          </Card>
          <Card title="Trial Balance" subtitle={`${trialBalance.length} accounts`}>
            <SimpleTable
              headers={['Code', 'Name', 'Debit', 'Credit', 'Balance']}
              rows={trialBalance.slice(0, 20).map((r) => [r.code, r.name, money(r.debit), money(r.credit), money(r.balance)])}
            />
          </Card>
        </section>
      )}

      {tab === 'ar' && (
        <section className="grid gap-4 lg:grid-cols-2">
          <Card title="Customers" subtitle={`${customers.length} customers`}>
            <SimpleTable headers={['Code', 'Name', 'Email']} rows={customers.slice(0, 20).map((c) => [c.code, c.name, c.email || '—'])} />
          </Card>
          <Card title="AR Invoices" subtitle={`${invoices.length} invoices`}>
            <SimpleTable
              headers={['Invoice #', 'Customer', 'Total', 'Paid', 'Status']}
              rows={invoices.slice(0, 20).map((i) => [i.invoiceNo, i.customer?.name || '—', money(i.totalAmount), money(i.paidAmount), i.status])}
            />
          </Card>
        </section>
      )}

      {tab === 'ap' && (
        <section className="grid gap-4 lg:grid-cols-2">
          <Card title="Vendors" subtitle={`${vendors.length} vendors`}>
            <SimpleTable headers={['Code', 'Name', 'Email']} rows={vendors.slice(0, 20).map((v) => [v.code, v.name, v.email || '—'])} />
          </Card>
          <Card title="AP Bills" subtitle={`${bills.length} bills`}>
            <SimpleTable
              headers={['Bill #', 'Vendor', 'Total', 'Paid', 'Status']}
              rows={bills.slice(0, 20).map((b) => [b.billNo, b.vendor?.name || '—', money(b.totalAmount), money(b.paidAmount), b.status])}
            />
          </Card>
        </section>
      )}

      {tab === 'tax' && (
        <section className="grid gap-4 lg:grid-cols-2">
          <Card title="Tax Rates" subtitle={`${taxRates.length} configured rates`}>
            <SimpleTable
              headers={['Name', 'Type', 'Rate', 'Active']}
              rows={taxRates.slice(0, 30).map((t) => [t.name, t.taxType, `${Number(t.rate).toFixed(2)}%`, t.isActive ? 'Yes' : 'No'])}
            />
          </Card>
          <Card title="Tax Returns" subtitle={`${taxReturns.length} returns`}>
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  const end = new Date();
                  const start = new Date(end.getFullYear(), end.getMonth(), 1);
                  await api.post('/accounting/tax/returns/generate', {
                    taxType: 'VAT',
                    periodStart: start.toISOString(),
                    periodEnd: end.toISOString(),
                  });
                  await loadAll();
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
              >
                Generate Current VAT Return
              </button>
            </div>
            <SimpleTable
              headers={['Type', 'Period', 'Output', 'Input', 'Net', 'Status']}
              rows={taxReturns.slice(0, 20).map((r) => [
                r.taxType,
                `${dateOnly(r.periodStart)} → ${dateOnly(r.periodEnd)}`,
                money(r.outputTax),
                money(r.inputTax),
                money(r.netTaxPayable),
                r.status,
              ])}
            />
            <div className="mt-3 space-y-2">
              {taxReturns.slice(0, 5).map((r) => (
                <div key={r.id} className="flex flex-wrap gap-2 rounded-lg border border-slate-100 p-2 text-xs">
                  <span className="font-medium">{r.taxType} {dateOnly(r.periodStart)}</span>
                  {r.status === 'DRAFT' && (
                    <button
                      onClick={async () => {
                        await api.post(`/accounting/tax/returns/${r.id}/file`, {});
                        await loadAll();
                      }}
                      className="rounded border border-indigo-300 px-2 py-0.5 text-indigo-700 hover:bg-indigo-50"
                    >
                      File Return
                    </button>
                  )}
                  {r.status === 'FILED' && (
                    <button
                      onClick={async () => {
                        await api.post(`/accounting/tax/returns/${r.id}/pay`, { paymentReference: `PAY-${Date.now()}` });
                        await loadAll();
                      }}
                      className="rounded border border-emerald-300 px-2 py-0.5 text-emerald-700 hover:bg-emerald-50"
                    >
                      Mark Paid
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {tab === 'period' && (
        <Card title="Accounting Periods" subtitle={`${periods.length} periods`}>
          <SimpleTable
            headers={['Name', 'Start', 'End', 'Status', 'Closed At']}
            rows={periods.slice(0, 30).map((p) => [p.name, dateOnly(p.startDate), dateOnly(p.endDate), p.status, p.closedAt ? new Date(p.closedAt).toLocaleString() : '—'])}
          />
        </Card>
      )}

      {tab === 'reports' && (
        <section className="grid gap-4 lg:grid-cols-3">
          <StatCard title="P&L Net Income" value={money(reports?.pnl?.netIncome || 0)} />
          <StatCard title="Balance Sheet Check" value={money(reports?.bs?.check || 0)} hint="0 means balanced" />
          <StatCard title="Cashflow Net" value={money(reports?.cf?.netCashflow || 0)} />
        </section>
      )}
    </div>
  );
}

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function dateOnly(v: string) {
  return new Date(v).toISOString().slice(0, 10);
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {subtitle ? <p className="mb-3 text-xs text-slate-500">{subtitle}</p> : null}
      {children}
    </div>
  );
}

function StatCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: Array<Array<string>> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} className="px-3 py-8 text-center text-slate-400">No data.</td></tr>
          ) : (
            rows.map((row, idx) => (
              <tr key={idx} className="border-b border-slate-100">
                {row.map((cell, i) => (
                  <td key={i} className="px-3 py-2">{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
