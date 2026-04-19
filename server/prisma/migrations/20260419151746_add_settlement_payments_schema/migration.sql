-- CreateTable
CREATE TABLE "employee_device_sessions" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_name" TEXT NOT NULL,
    "platform" TEXT,
    "app_version" TEXT,
    "is_trusted" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_device_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_refresh_tokens" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_session_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_payments" (
    "id" TEXT NOT NULL,
    "settlement_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "recorded_by_user_id" TEXT,
    "status_after_payment" "SettlementStatus" NOT NULL,
    "amount_naira" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount_liters" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payment_reference" TEXT,
    "payment_channel" TEXT,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "evidence_document_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_device_sessions_employee_id_idx" ON "employee_device_sessions"("employee_id");

-- CreateIndex
CREATE INDEX "employee_device_sessions_device_id_idx" ON "employee_device_sessions"("device_id");

-- CreateIndex
CREATE INDEX "employee_device_sessions_revoked_at_idx" ON "employee_device_sessions"("revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "employee_device_sessions_employee_id_device_id_key" ON "employee_device_sessions"("employee_id", "device_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_refresh_tokens_token_hash_key" ON "employee_refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "employee_refresh_tokens_employee_id_idx" ON "employee_refresh_tokens"("employee_id");

-- CreateIndex
CREATE INDEX "employee_refresh_tokens_device_session_id_idx" ON "employee_refresh_tokens"("device_session_id");

-- CreateIndex
CREATE INDEX "employee_refresh_tokens_expires_at_idx" ON "employee_refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "settlement_payments_evidence_document_id_key" ON "settlement_payments"("evidence_document_id");

-- CreateIndex
CREATE INDEX "settlement_payments_settlement_id_idx" ON "settlement_payments"("settlement_id");

-- CreateIndex
CREATE INDEX "settlement_payments_organization_id_idx" ON "settlement_payments"("organization_id");

-- CreateIndex
CREATE INDEX "settlement_payments_payment_date_idx" ON "settlement_payments"("payment_date");

-- CreateIndex
CREATE INDEX "settlement_payments_status_after_payment_idx" ON "settlement_payments"("status_after_payment");

-- AddForeignKey
ALTER TABLE "employee_device_sessions" ADD CONSTRAINT "employee_device_sessions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_refresh_tokens" ADD CONSTRAINT "employee_refresh_tokens_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_refresh_tokens" ADD CONSTRAINT "employee_refresh_tokens_device_session_id_fkey" FOREIGN KEY ("device_session_id") REFERENCES "employee_device_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_payments" ADD CONSTRAINT "settlement_payments_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_payments" ADD CONSTRAINT "settlement_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_payments" ADD CONSTRAINT "settlement_payments_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_payments" ADD CONSTRAINT "settlement_payments_evidence_document_id_fkey" FOREIGN KEY ("evidence_document_id") REFERENCES "stored_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
