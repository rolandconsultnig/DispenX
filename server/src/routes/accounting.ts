import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createAccountingAccountSchema,
  createAccountingPeriodSchema,
  createApBillSchema,
  createApPaymentSchema,
  createArInvoiceSchema,
  createArReceiptSchema,
  createCustomerSchema,
  createJournalEntrySchema,
  createTaxRateSchema,
  createVendorSchema,
  fileTaxReturnSchema,
  generateTaxReturnSchema,
  payTaxReturnSchema,
} from "../schemas";
import { AppError } from "../middleware/errorHandler";

const router = Router();

function orgId(req: Request): string {
  const candidate = req.user!.role === "SUPER_ADMIN" ? String(req.query.organizationId || req.body.organizationId || "") : req.user!.organizationId;
  if (!candidate) throw new AppError("organizationId is required", 400);
  return candidate;
}

async function ensureAccount(tx: any, organizationId: string, params: { code: string; name: string; accountType: any; subType?: string }) {
  let account = await tx.accountingAccount.findFirst({ where: { organizationId, code: params.code } });
  if (!account) {
    account = await tx.accountingAccount.create({
      data: {
        organizationId,
        code: params.code,
        name: params.name,
        accountType: params.accountType,
        subType: params.subType || null,
      },
    });
  }
  return account;
}

async function postJournal(tx: any, args: {
  organizationId: string;
  postedByUserId: string;
  entryDate?: Date;
  description: string;
  source: string;
  reference?: string;
  lines: Array<{ accountId: string; debit?: number; credit?: number; memo?: string }>;
}) {
  const totalDebit = args.lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = args.lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.0001) {
    throw new AppError("Auto-posted journal is not balanced", 500);
  }
  return tx.journalEntry.create({
    data: {
      organizationId: args.organizationId,
      entryDate: args.entryDate || new Date(),
      description: args.description,
      source: args.source,
      reference: args.reference || null,
      postedByUserId: args.postedByUserId,
      postedAt: new Date(),
      lines: {
        create: args.lines.map((l) => ({
          accountId: l.accountId,
          debit: Number(l.debit || 0),
          credit: Number(l.credit || 0),
          memo: l.memo || null,
        })),
      },
    },
  });
}

// Chart of Accounts
router.get("/accounts", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), async (req, res, next) => {
  try {
    const rows = await prisma.accountingAccount.findMany({
      where: { organizationId: orgId(req), ...(req.query.accountType ? { accountType: String(req.query.accountType) as any } : {}) },
      orderBy: [{ accountType: "asc" }, { code: "asc" }],
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post("/accounts", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), validate(createAccountingAccountSchema), async (req, res, next) => {
  try {
    const row = await prisma.accountingAccount.create({
      data: {
        organizationId: orgId(req),
        code: req.body.code.trim().toUpperCase(),
        name: req.body.name.trim(),
        accountType: req.body.accountType,
        subType: req.body.subType || null,
      },
    });
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
});

// Journal Entries
router.get("/journal-entries", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), async (req, res, next) => {
  try {
    const where: any = { organizationId: orgId(req) };
    if (req.query.from || req.query.to) {
      where.entryDate = {
        ...(req.query.from ? { gte: new Date(String(req.query.from)) } : {}),
        ...(req.query.to ? { lte: new Date(String(req.query.to)) } : {}),
      };
    }
    const rows = await prisma.journalEntry.findMany({
      where,
      orderBy: { entryDate: "desc" },
      include: { lines: { include: { account: true } } },
      take: 200,
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post("/journal-entries", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), validate(createJournalEntrySchema), async (req, res, next) => {
  try {
    const organizationId = orgId(req);
    const lines = req.body.lines as Array<{ accountId: string; debit?: number; credit?: number; memo?: string }>;
    const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.0001) {
      return next(new AppError("Journal entry must be balanced (debit == credit)", 400));
    }

    const created = await prisma.journalEntry.create({
      data: {
        organizationId,
        periodId: req.body.periodId || null,
        entryDate: req.body.entryDate ? new Date(req.body.entryDate) : new Date(),
        description: req.body.description,
        source: req.body.source || "MANUAL",
        reference: req.body.reference || null,
        postedByUserId: req.user!.userId,
        postedAt: new Date(),
        lines: {
          create: lines.map((l) => ({
            accountId: l.accountId,
            debit: Number(l.debit || 0),
            credit: Number(l.credit || 0),
            memo: l.memo || null,
          })),
        },
      },
      include: { lines: true },
    });

    res.status(201).json({ success: true, data: created });
  } catch (err) { next(err); }
});

router.get("/trial-balance", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), async (req, res, next) => {
  try {
    const organizationId = orgId(req);
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().getFullYear(), 0, 1);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    to.setHours(23, 59, 59, 999);

    const lines = await prisma.journalLine.findMany({
      where: {
        journalEntry: { organizationId, entryDate: { gte: from, lte: to } },
      },
      include: { account: true },
    });

    const map = new Map<string, { accountId: string; code: string; name: string; type: string; debit: number; credit: number; balance: number }>();
    for (const l of lines) {
      const key = l.accountId;
      if (!map.has(key)) map.set(key, { accountId: key, code: l.account.code, name: l.account.name, type: l.account.accountType, debit: 0, credit: 0, balance: 0 });
      const r = map.get(key)!;
      r.debit += Number(l.debit || 0);
      r.credit += Number(l.credit || 0);
      r.balance = r.debit - r.credit;
    }
    const rows = Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
    const totals = rows.reduce((acc, r) => ({ debit: acc.debit + r.debit, credit: acc.credit + r.credit }), { debit: 0, credit: 0 });
    res.json({ success: true, data: rows, totals, period: { from, to } });
  } catch (err) { next(err); }
});

// AR
router.get("/ar/customers", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), async (req, res, next) => {
  try {
    const rows = await prisma.customer.findMany({ where: { organizationId: orgId(req) }, orderBy: { name: "asc" } });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});
router.post("/ar/customers", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), validate(createCustomerSchema), async (req, res, next) => {
  try {
    const row = await prisma.customer.create({ data: { organizationId: orgId(req), ...req.body } });
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
});

router.get("/ar/invoices", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), async (req, res, next) => {
  try {
    const rows = await prisma.arInvoice.findMany({
      where: { organizationId: orgId(req), ...(req.query.status ? { status: String(req.query.status) as any } : {}) },
      include: { customer: true, lines: true, receipts: true },
      orderBy: { issueDate: "desc" },
      take: 300,
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});
router.post("/ar/invoices", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), validate(createArInvoiceSchema), async (req, res, next) => {
  try {
    const organizationId = orgId(req);
    const lines = req.body.lines as Array<{ description: string; quantity?: number; unitPrice: number; taxRateId?: string }>;
    let subtotal = 0;
    let taxAmount = 0;
    const materialized: Array<{ description: string; quantity: number; unitPrice: number; lineTotal: number; taxRateId: string | null }> = [];
    for (const line of lines) {
      const qty = Number(line.quantity || 1);
      const lineTotal = qty * Number(line.unitPrice || 0);
      subtotal += lineTotal;
      let taxLine = 0;
      if (line.taxRateId) {
        const rate = await prisma.taxRate.findFirst({ where: { id: line.taxRateId, organizationId } });
        if (rate) taxLine = lineTotal * (Number(rate.rate || 0) / 100);
      }
      taxAmount += taxLine;
      materialized.push({ description: line.description, quantity: qty, unitPrice: Number(line.unitPrice), lineTotal, taxRateId: line.taxRateId || null });
    }
    const totalAmount = subtotal + taxAmount;
    const issueDate = req.body.issueDate ? new Date(req.body.issueDate) : new Date();
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.arInvoice.create({
        data: {
          organizationId,
          customerId: req.body.customerId,
          invoiceNo: req.body.invoiceNo.trim(),
          issueDate,
          dueDate: new Date(req.body.dueDate),
          subtotal,
          taxAmount,
          totalAmount,
          status: "ISSUED",
          notes: req.body.notes || null,
          lines: { create: materialized },
        },
        include: { lines: true, customer: true },
      });

      const ar = await ensureAccount(tx, organizationId, { code: "1100", name: "Accounts Receivable", accountType: "ASSET", subType: "AR" });
      const rev = await ensureAccount(tx, organizationId, { code: "4000", name: "Sales Revenue", accountType: "REVENUE", subType: "SALES" });
      const vatPayable = await ensureAccount(tx, organizationId, { code: "2120", name: "VAT Payable", accountType: "LIABILITY", subType: "TAX_PAYABLE" });

      await postJournal(tx, {
        organizationId,
        postedByUserId: req.user!.userId,
        entryDate: issueDate,
        description: `AR Invoice ${created.invoiceNo}`,
        source: "AR_INVOICE",
        reference: created.id,
        lines: [
          { accountId: ar.id, debit: totalAmount, memo: "Invoice receivable" },
          { accountId: rev.id, credit: subtotal, memo: "Revenue" },
          ...(taxAmount > 0 ? [{ accountId: vatPayable.id, credit: taxAmount, memo: "Output VAT" }] : []),
        ],
      });
      return created;
    });
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
});

router.post("/ar/receipts", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), validate(createArReceiptSchema), async (req, res, next) => {
  try {
    const organizationId = orgId(req);
    const receipt = await prisma.$transaction(async (tx) => {
      const paymentDate = req.body.paymentDate ? new Date(req.body.paymentDate) : new Date();
      const created = await tx.arReceipt.create({
        data: {
          organizationId,
          customerId: req.body.customerId,
          invoiceId: req.body.invoiceId || null,
          receiptNo: req.body.receiptNo,
          paymentDate,
          amount: req.body.amount,
          reference: req.body.reference || null,
          channel: req.body.channel || null,
          notes: req.body.notes || null,
        },
      });
      if (req.body.invoiceId) {
        const inv = await tx.arInvoice.findUnique({ where: { id: req.body.invoiceId } });
        if (!inv) throw new AppError("Invoice not found", 404);
        const nextPaid = Number(inv.paidAmount || 0) + Number(req.body.amount || 0);
        const nextStatus = nextPaid >= Number(inv.totalAmount || 0) ? "PAID" : "PARTIALLY_PAID";
        await tx.arInvoice.update({ where: { id: inv.id }, data: { paidAmount: nextPaid, status: nextStatus as any } });
      }

      const cash = await ensureAccount(tx, organizationId, { code: "1000", name: "Cash and Bank", accountType: "ASSET", subType: "CASH" });
      const ar = await ensureAccount(tx, organizationId, { code: "1100", name: "Accounts Receivable", accountType: "ASSET", subType: "AR" });
      await postJournal(tx, {
        organizationId,
        postedByUserId: req.user!.userId,
        entryDate: paymentDate,
        description: `AR Receipt ${created.receiptNo}`,
        source: "AR_RECEIPT",
        reference: created.id,
        lines: [
          { accountId: cash.id, debit: req.body.amount, memo: "Cash received" },
          { accountId: ar.id, credit: req.body.amount, memo: "Receivable settled" },
        ],
      });
      return created;
    });
    res.status(201).json({ success: true, data: receipt });
  } catch (err) { next(err); }
});

router.get("/ar/aging", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), async (req, res, next) => {
  try {
    const rows = await prisma.arInvoice.findMany({
      where: { organizationId: orgId(req), status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } },
      include: { customer: true },
    });
    const now = Date.now();
    const buckets = { current: 0, due30: 0, due60: 0, due90: 0, due90plus: 0 };
    for (const i of rows) {
      const outstanding = Math.max(0, Number(i.totalAmount || 0) - Number(i.paidAmount || 0));
      const days = Math.floor((now - new Date(i.dueDate).getTime()) / 86400000);
      if (days <= 0) buckets.current += outstanding;
      else if (days <= 30) buckets.due30 += outstanding;
      else if (days <= 60) buckets.due60 += outstanding;
      else if (days <= 90) buckets.due90 += outstanding;
      else buckets.due90plus += outstanding;
    }
    res.json({ success: true, data: { buckets, invoices: rows } });
  } catch (err) { next(err); }
});

// AP
router.get("/ap/vendors", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), async (req, res, next) => {
  try {
    const rows = await prisma.vendor.findMany({ where: { organizationId: orgId(req) }, orderBy: { name: "asc" } });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});
router.post("/ap/vendors", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), validate(createVendorSchema), async (req, res, next) => {
  try {
    const row = await prisma.vendor.create({ data: { organizationId: orgId(req), ...req.body } });
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
});

router.get("/ap/bills", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), async (req, res, next) => {
  try {
    const rows = await prisma.apBill.findMany({
      where: { organizationId: orgId(req), ...(req.query.status ? { status: String(req.query.status) as any } : {}) },
      include: { vendor: true, lines: true, payments: true },
      orderBy: { issueDate: "desc" },
      take: 300,
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});
router.post("/ap/bills", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), validate(createApBillSchema), async (req, res, next) => {
  try {
    const organizationId = orgId(req);
    const lines = req.body.lines as Array<{ description: string; quantity?: number; unitPrice: number; taxRateId?: string }>;
    let subtotal = 0;
    let taxAmount = 0;
    const materialized: Array<{ description: string; quantity: number; unitPrice: number; lineTotal: number; taxRateId: string | null }> = [];
    for (const line of lines) {
      const qty = Number(line.quantity || 1);
      const lineTotal = qty * Number(line.unitPrice || 0);
      subtotal += lineTotal;
      let taxLine = 0;
      if (line.taxRateId) {
        const rate = await prisma.taxRate.findFirst({ where: { id: line.taxRateId, organizationId } });
        if (rate) taxLine = lineTotal * (Number(rate.rate || 0) / 100);
      }
      taxAmount += taxLine;
      materialized.push({ description: line.description, quantity: qty, unitPrice: Number(line.unitPrice), lineTotal, taxRateId: line.taxRateId || null });
    }
    const totalAmount = subtotal + taxAmount;
    const issueDate = req.body.issueDate ? new Date(req.body.issueDate) : new Date();
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.apBill.create({
        data: {
          organizationId,
          vendorId: req.body.vendorId,
          billNo: req.body.billNo.trim(),
          issueDate,
          dueDate: new Date(req.body.dueDate),
          subtotal,
          taxAmount,
          totalAmount,
          status: "POSTED",
          notes: req.body.notes || null,
          lines: { create: materialized },
        },
        include: { lines: true, vendor: true },
      });

      const expense = await ensureAccount(tx, organizationId, { code: "5000", name: "Operating Expense", accountType: "EXPENSE", subType: "OPEX" });
      const vatInput = await ensureAccount(tx, organizationId, { code: "1170", name: "VAT Receivable", accountType: "ASSET", subType: "TAX_RECEIVABLE" });
      const ap = await ensureAccount(tx, organizationId, { code: "2000", name: "Accounts Payable", accountType: "LIABILITY", subType: "AP" });

      await postJournal(tx, {
        organizationId,
        postedByUserId: req.user!.userId,
        entryDate: issueDate,
        description: `AP Bill ${created.billNo}`,
        source: "AP_BILL",
        reference: created.id,
        lines: [
          { accountId: expense.id, debit: subtotal, memo: "Expense recognition" },
          ...(taxAmount > 0 ? [{ accountId: vatInput.id, debit: taxAmount, memo: "Input VAT" }] : []),
          { accountId: ap.id, credit: totalAmount, memo: "Payable recognized" },
        ],
      });
      return created;
    });
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
});

router.post("/ap/payments", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), validate(createApPaymentSchema), async (req, res, next) => {
  try {
    const organizationId = orgId(req);
    const payment = await prisma.$transaction(async (tx) => {
      const paymentDate = req.body.paymentDate ? new Date(req.body.paymentDate) : new Date();
      const created = await tx.apPayment.create({
        data: {
          organizationId,
          vendorId: req.body.vendorId,
          billId: req.body.billId || null,
          paymentNo: req.body.paymentNo,
          paymentDate,
          amount: req.body.amount,
          reference: req.body.reference || null,
          channel: req.body.channel || null,
          notes: req.body.notes || null,
        },
      });
      if (req.body.billId) {
        const bill = await tx.apBill.findUnique({ where: { id: req.body.billId } });
        if (!bill) throw new AppError("Bill not found", 404);
        const nextPaid = Number(bill.paidAmount || 0) + Number(req.body.amount || 0);
        const nextStatus = nextPaid >= Number(bill.totalAmount || 0) ? "PAID" : "PARTIALLY_PAID";
        await tx.apBill.update({ where: { id: bill.id }, data: { paidAmount: nextPaid, status: nextStatus as any } });
      }

      const ap = await ensureAccount(tx, organizationId, { code: "2000", name: "Accounts Payable", accountType: "LIABILITY", subType: "AP" });
      const cash = await ensureAccount(tx, organizationId, { code: "1000", name: "Cash and Bank", accountType: "ASSET", subType: "CASH" });
      await postJournal(tx, {
        organizationId,
        postedByUserId: req.user!.userId,
        entryDate: paymentDate,
        description: `AP Payment ${created.paymentNo}`,
        source: "AP_PAYMENT",
        reference: created.id,
        lines: [
          { accountId: ap.id, debit: req.body.amount, memo: "Payable settled" },
          { accountId: cash.id, credit: req.body.amount, memo: "Cash paid out" },
        ],
      });
      return created;
    });
    res.status(201).json({ success: true, data: payment });
  } catch (err) { next(err); }
});

router.get("/ap/aging", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), async (req, res, next) => {
  try {
    const rows = await prisma.apBill.findMany({
      where: { organizationId: orgId(req), status: { in: ["POSTED", "PARTIALLY_PAID", "OVERDUE"] } },
      include: { vendor: true },
    });
    const now = Date.now();
    const buckets = { current: 0, due30: 0, due60: 0, due90: 0, due90plus: 0 };
    for (const i of rows) {
      const outstanding = Math.max(0, Number(i.totalAmount || 0) - Number(i.paidAmount || 0));
      const days = Math.floor((now - new Date(i.dueDate).getTime()) / 86400000);
      if (days <= 0) buckets.current += outstanding;
      else if (days <= 30) buckets.due30 += outstanding;
      else if (days <= 60) buckets.due60 += outstanding;
      else if (days <= 90) buckets.due90 += outstanding;
      else buckets.due90plus += outstanding;
    }
    res.json({ success: true, data: { buckets, bills: rows } });
  } catch (err) { next(err); }
});

// Tax
router.get("/tax/rates", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), async (req, res, next) => {
  try {
    const rows = await prisma.taxRate.findMany({ where: { organizationId: orgId(req) }, orderBy: [{ taxType: "asc" }, { name: "asc" }] });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});
router.post("/tax/rates", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), validate(createTaxRateSchema), async (req, res, next) => {
  try {
    const row = await prisma.taxRate.create({ data: { organizationId: orgId(req), ...req.body } });
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
});

router.get("/tax/summary", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), async (req, res, next) => {
  try {
    const organizationId = orgId(req);
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    to.setHours(23, 59, 59, 999);

    const [ar, ap] = await Promise.all([
      prisma.arInvoice.aggregate({ where: { organizationId, issueDate: { gte: from, lte: to } }, _sum: { taxAmount: true } }),
      prisma.apBill.aggregate({ where: { organizationId, issueDate: { gte: from, lte: to } }, _sum: { taxAmount: true } }),
    ]);

    const outputTax = Number(ar._sum.taxAmount || 0);
    const inputTax = Number(ap._sum.taxAmount || 0);
    const payable = outputTax - inputTax;
    res.json({ success: true, data: { period: { from, to }, outputTax, inputTax, netTaxPayable: payable } });
  } catch (err) { next(err); }
});

router.get("/tax/returns", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), async (req, res, next) => {
  try {
    const rows = await prisma.taxReturn.findMany({
      where: { organizationId: orgId(req), ...(req.query.taxType ? { taxType: String(req.query.taxType) } : {}) },
      orderBy: { periodStart: "desc" },
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post("/tax/returns/generate", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), validate(generateTaxReturnSchema), async (req, res, next) => {
  try {
    const organizationId = orgId(req);
    const periodStart = new Date(req.body.periodStart);
    const periodEnd = new Date(req.body.periodEnd);
    const taxType = req.body.taxType || "VAT";
    const adjustments = Number(req.body.adjustments || 0);

    const [ar, ap] = await Promise.all([
      prisma.arInvoice.aggregate({ where: { organizationId, issueDate: { gte: periodStart, lte: periodEnd } }, _sum: { taxAmount: true } }),
      prisma.apBill.aggregate({ where: { organizationId, issueDate: { gte: periodStart, lte: periodEnd } }, _sum: { taxAmount: true } }),
    ]);
    const outputTax = Number(ar._sum.taxAmount || 0);
    const inputTax = Number(ap._sum.taxAmount || 0);
    const netTaxPayable = outputTax - inputTax + adjustments;

    const row = await prisma.taxReturn.create({
      data: {
        organizationId,
        taxType,
        periodStart,
        periodEnd,
        outputTax,
        inputTax,
        adjustments,
        netTaxPayable,
        status: "DRAFT",
        notes: req.body.notes || null,
      },
    });
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
});

router.post("/tax/returns/:id/file", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), validate(fileTaxReturnSchema), async (req, res, next) => {
  try {
    const ret = await prisma.taxReturn.findUnique({ where: { id: req.params.id } });
    if (!ret) return next(new AppError("Tax return not found", 404));
    if (req.user!.role !== "SUPER_ADMIN" && ret.organizationId !== req.user!.organizationId) {
      return next(new AppError("Insufficient permissions", 403));
    }
    if (ret.status !== "DRAFT") return next(new AppError("Only draft returns can be filed", 400));

    const updated = await prisma.$transaction(async (tx) => {
      const taxPayable = await ensureAccount(tx, ret.organizationId, { code: "2120", name: "VAT Payable", accountType: "LIABILITY", subType: "TAX_PAYABLE" });
      const taxExpense = await ensureAccount(tx, ret.organizationId, { code: "6100", name: "Tax Expense", accountType: "EXPENSE", subType: "TAX_EXPENSE" });
      const taxReceivable = await ensureAccount(tx, ret.organizationId, { code: "1170", name: "VAT Receivable", accountType: "ASSET", subType: "TAX_RECEIVABLE" });

      if (ret.netTaxPayable >= 0) {
        await postJournal(tx, {
          organizationId: ret.organizationId,
          postedByUserId: req.user!.userId,
          entryDate: new Date(),
          description: `Tax return filed ${ret.taxType} ${ret.periodStart.toISOString().slice(0, 10)}-${ret.periodEnd.toISOString().slice(0, 10)}`,
          source: "TAX_RETURN_FILE",
          reference: ret.id,
          lines: [
            { accountId: taxExpense.id, debit: ret.netTaxPayable, memo: "Tax expense recognized" },
            { accountId: taxPayable.id, credit: ret.netTaxPayable, memo: "Tax payable recognized" },
          ],
        });
      } else {
        const refund = Math.abs(ret.netTaxPayable);
        await postJournal(tx, {
          organizationId: ret.organizationId,
          postedByUserId: req.user!.userId,
          entryDate: new Date(),
          description: `Tax return filed ${ret.taxType} refund`,
          source: "TAX_RETURN_FILE",
          reference: ret.id,
          lines: [
            { accountId: taxReceivable.id, debit: refund, memo: "Tax refund receivable" },
            { accountId: taxExpense.id, credit: refund, memo: "Tax expense reversal" },
          ],
        });
      }

      return tx.taxReturn.update({
        where: { id: ret.id },
        data: {
          status: "FILED",
          filedAt: new Date(),
          filedByUserId: req.user!.userId,
          notes: req.body.notes || ret.notes,
        },
      });
    });

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.post("/tax/returns/:id/pay", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), validate(payTaxReturnSchema), async (req, res, next) => {
  try {
    const ret = await prisma.taxReturn.findUnique({ where: { id: req.params.id } });
    if (!ret) return next(new AppError("Tax return not found", 404));
    if (req.user!.role !== "SUPER_ADMIN" && ret.organizationId !== req.user!.organizationId) {
      return next(new AppError("Insufficient permissions", 403));
    }
    if (ret.status !== "FILED") return next(new AppError("Only filed returns can be marked paid", 400));

    const updated = await prisma.$transaction(async (tx) => {
      const cash = await ensureAccount(tx, ret.organizationId, { code: "1000", name: "Cash and Bank", accountType: "ASSET", subType: "CASH" });
      const taxPayable = await ensureAccount(tx, ret.organizationId, { code: "2120", name: "VAT Payable", accountType: "LIABILITY", subType: "TAX_PAYABLE" });
      const amount = Math.max(0, Number(ret.netTaxPayable || 0));
      if (amount > 0) {
        await postJournal(tx, {
          organizationId: ret.organizationId,
          postedByUserId: req.user!.userId,
          entryDate: new Date(),
          description: `Tax payment ${ret.taxType}`,
          source: "TAX_RETURN_PAYMENT",
          reference: ret.id,
          lines: [
            { accountId: taxPayable.id, debit: amount, memo: "Tax payable settled" },
            { accountId: cash.id, credit: amount, memo: "Cash paid for tax" },
          ],
        });
      }
      return tx.taxReturn.update({
        where: { id: ret.id },
        data: { status: "PAID", paymentReference: req.body.paymentReference || null, notes: req.body.notes || ret.notes },
      });
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// Period Close & Statements
router.get("/periods", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), async (req, res, next) => {
  try {
    const rows = await prisma.accountingPeriod.findMany({ where: { organizationId: orgId(req) }, orderBy: { startDate: "desc" } });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});
router.post("/periods", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), validate(createAccountingPeriodSchema), async (req, res, next) => {
  try {
    const row = await prisma.accountingPeriod.create({
      data: {
        organizationId: orgId(req),
        name: req.body.name,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
      },
    });
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
});
router.post("/periods/:id/close", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), async (req, res, next) => {
  try {
    const period = await prisma.accountingPeriod.findUnique({ where: { id: req.params.id } });
    if (!period) return next(new AppError("Accounting period not found", 404));
    if (req.user!.role !== "SUPER_ADMIN" && period.organizationId !== req.user!.organizationId) {
      return next(new AppError("Insufficient permissions", 403));
    }
    const closed = await prisma.accountingPeriod.update({
      where: { id: period.id },
      data: { status: "CLOSED", closedAt: new Date(), closedByUserId: req.user!.userId },
    });
    res.json({ success: true, data: closed });
  } catch (err) { next(err); }
});

router.get("/reports/pnl", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), async (req, res, next) => {
  try {
    const organizationId = orgId(req);
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().getFullYear(), 0, 1);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    to.setHours(23, 59, 59, 999);
    const lines = await prisma.journalLine.findMany({
      where: { journalEntry: { organizationId, entryDate: { gte: from, lte: to } } },
      include: { account: true },
    });
    let revenue = 0;
    let expenses = 0;
    for (const l of lines) {
      if (l.account.accountType === "REVENUE") revenue += Number(l.credit || 0) - Number(l.debit || 0);
      if (l.account.accountType === "EXPENSE" || l.account.accountType === "COGS") expenses += Number(l.debit || 0) - Number(l.credit || 0);
    }
    res.json({ success: true, data: { period: { from, to }, revenue, expenses, netIncome: revenue - expenses } });
  } catch (err) { next(err); }
});

router.get("/reports/balance-sheet", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), async (req, res, next) => {
  try {
    const organizationId = orgId(req);
    const asOf = req.query.asOf ? new Date(String(req.query.asOf)) : new Date();
    asOf.setHours(23, 59, 59, 999);
    const lines = await prisma.journalLine.findMany({
      where: { journalEntry: { organizationId, entryDate: { lte: asOf } } },
      include: { account: true },
    });
    let assets = 0;
    let liabilities = 0;
    let equity = 0;
    for (const l of lines) {
      if (l.account.accountType === "ASSET") assets += Number(l.debit || 0) - Number(l.credit || 0);
      if (l.account.accountType === "LIABILITY") liabilities += Number(l.credit || 0) - Number(l.debit || 0);
      if (l.account.accountType === "EQUITY") equity += Number(l.credit || 0) - Number(l.debit || 0);
    }
    res.json({ success: true, data: { asOf, assets, liabilities, equity, check: assets - (liabilities + equity) } });
  } catch (err) { next(err); }
});

router.get("/reports/cashflow", authenticate, authorize("SUPER_ADMIN", "ADMIN", "FINANCE"), async (req, res, next) => {
  try {
    const organizationId = orgId(req);
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    to.setHours(23, 59, 59, 999);
    const lines = await prisma.journalLine.findMany({
      where: {
        journalEntry: { organizationId, entryDate: { gte: from, lte: to } },
        account: { subType: { in: ["CASH", "BANK"] } },
      },
      include: { account: true },
    });
    const inflow = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const outflow = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    res.json({ success: true, data: { period: { from, to }, inflow, outflow, netCashflow: inflow - outflow } });
  } catch (err) { next(err); }
});

export default router;
