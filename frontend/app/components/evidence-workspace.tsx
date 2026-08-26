"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import type { EvidenceDocumentRecord } from "@/lib/pillarprep/types";


const DOCUMENT_TYPES = [
  ["architecture", "Architecture"],
  ["business-objective", "Business objective"],
  ["company-profile", "Company profile"],
  ["compliance", "Compliance"],
  ["constraints-risks", "Constraints and risks"],
  ["customer-notes", "Customer notes"],
  ["meeting-notes", "Meeting notes"],
  ["policy", "Policy"],
  ["requirements", "Requirements"],
  ["stakeholder-profile", "Stakeholder profile"],
  ["technical-inventory", "Technical inventory"],
] as const;

export type EvidenceUpload = {
  documentId: string;
  fileName: string;
  sourceTitle: string;
  documentType: string;
  source: string;
  content: string;
};

type EvidenceWorkspaceProps = {
  authenticated: boolean;
  company: string;
  documents: EvidenceDocumentRecord[];
  loading: boolean;
  busyDocumentId: string;
  error: string;
  notice: string;
  onSignIn: () => void;
  onRefresh: () => Promise<void>;
  onUpload: (input: EvidenceUpload) => Promise<void>;
  onReindex: (documentId: string) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
};

function documentSlug(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 56) || "customer-evidence"
  );
}

function statusLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function ProcessingClock({ label }: { label: string }) {
  return (
    <span className="processing-indicator" role="status" aria-live="polite">
      <svg className="processing-clock" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path className="processing-clock-hour" d="M12 12V7.5" />
        <path className="processing-clock-minute" d="M12 12h4" />
        <circle className="processing-clock-pin" cx="12" cy="12" r="1" />
      </svg>
      <strong>{label}</strong>
    </span>
  );
}

export function EvidenceWorkspace({
  authenticated,
  company,
  documents,
  loading,
  busyDocumentId,
  error,
  notice,
  onSignIn,
  onRefresh,
  onUpload,
  onReindex,
  onDelete,
}: EvidenceWorkspaceProps) {
  const [sourceTitle, setSourceTitle] = useState("");
  const [documentType, setDocumentType] = useState("requirements");
  const [source, setSource] = useState("Customer-approved notes");
  const [content, setContent] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState("");
  const documentId = useMemo(() => documentSlug(sourceTitle), [sourceTitle]);
  const isBusy = Boolean(busyDocumentId);

  async function submitEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await onUpload({
        documentId,
        fileName: `${documentId}.md`,
        sourceTitle: sourceTitle.trim(),
        documentType,
        source: source.trim(),
        content: content.trim(),
      });
      setSourceTitle("");
      setContent("");
    } catch {
      return;
    }
  }

  if (!authenticated) {
    return (
      <div className="evidence-page page-view">
        <section className="evidence-access-gate">
          <span className="evidence-kicker">Private workspace</span>
          <h1>Customer evidence requires a verified account</h1>
          <p>
            Guest mode uses synthetic scenarios only. Sign in before adding
            customer-approved requirements, architecture notes, policies, or
            stakeholder context.
          </p>
          <button className="primary-button" type="button" onClick={onSignIn}>
            Sign in with verified email
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="evidence-page page-view">
      <section className="evidence-workspace" aria-busy={loading || isBusy}>
        <header className="evidence-titlebar">
          <div>
            <span className="evidence-kicker">Approved customer grounding</span>
            <h1>Evidence for {company || "this client"}</h1>
            <p>
              Add only material approved for this client workspace. Retrieval
              remains filtered to this tenant, client, and project.
            </p>
          </div>
          <button
            className="small-action"
            type="button"
            onClick={() => void onRefresh()}
            disabled={loading || isBusy}
          >
            {loading ? <ProcessingClock label="Checking status..." /> : "Refresh status"}
          </button>
        </header>

        <div className="evidence-layout">
          <form className="evidence-upload-panel" onSubmit={submitEvidence}>
            <div className="evidence-section-heading">
              <span>New evidence</span>
              <strong>Add an approved source</strong>
            </div>
            <label className="block">
              <span className="field-label">Source title</span>
              <input
                className="field"
                value={sourceTitle}
                onChange={(event) => setSourceTitle(event.target.value)}
                placeholder="Approved payroll integration requirements"
                maxLength={240}
                required
                disabled={isBusy}
              />
            </label>
            <div className="evidence-field-row">
              <label className="block">
                <span className="field-label">Document type</span>
                <select
                  className="field"
                  value={documentType}
                  onChange={(event) => setDocumentType(event.target.value)}
                  disabled={isBusy}
                >
                  {DOCUMENT_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="field-label">Source</span>
                <input
                  className="field"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  maxLength={80}
                  disabled={isBusy}
                />
              </label>
            </div>
            <label className="block">
              <span className="field-label">Approved content</span>
              <textarea
                className="field evidence-content-field"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Paste the customer-approved facts, constraints, and requirements the AI may use as evidence."
                minLength={20}
                maxLength={120000}
                required
                disabled={isBusy}
              />
            </label>
            <div className="evidence-form-footer">
              <span>{content.length.toLocaleString()} / 120,000 characters</span>
              <button
                className="primary-button"
                type="submit"
                disabled={isBusy || sourceTitle.trim().length < 2 || content.trim().length < 20}
              >
                {busyDocumentId === "upload"
                  ? <ProcessingClock label="Adding evidence..." />
                  : "Add and index evidence"}
              </button>
            </div>
          </form>

          <section className="evidence-library-panel" aria-label="Client evidence">
            <div className="evidence-section-heading evidence-library-heading">
              <div>
                <span>Current sources</span>
                <strong>{documents.length} approved document{documents.length === 1 ? "" : "s"}</strong>
              </div>
              <small>Latest ingestion state</small>
            </div>

            {loading ? (
              <div className="evidence-empty">
                <ProcessingClock label="Loading approved evidence..." />
              </div>
            ) : documents.length ? (
              <div className="evidence-document-list">
                {documents.map((document) => {
                  const deleting = deleteCandidate === document.documentId;
                  const busy = busyDocumentId === document.documentId;
                  return (
                    <article className="evidence-document" key={document.documentId}>
                      <div className="evidence-document-main">
                        <div>
                          <span>{document.documentType.replace(/-/g, " ")}</span>
                          <strong>{document.sourceTitle}</strong>
                          <p>{document.source || document.fileName}</p>
                        </div>
                        <span className={`evidence-status evidence-status-${document.status.toLowerCase()}`}>
                          {statusLabel(document.status)}
                        </span>
                      </div>
                      <div className="evidence-document-meta">
                        <span>Version {document.version}</span>
                        <span>{document.approvedAt ? new Date(document.approvedAt).toLocaleString() : "Approval recorded"}</span>
                        {document.ingestionStatus ? <span>{statusLabel(document.ingestionStatus)}</span> : null}
                      </div>
                      <div className="evidence-document-actions">
                        <button
                          className="small-action"
                          type="button"
                          disabled={isBusy}
                          onClick={() => void onReindex(document.documentId)}
                        >
                          {busy && !deleting ? <ProcessingClock label="Re-indexing..." /> : "Re-index"}
                        </button>
                        {deleting ? (
                          <>
                            <button
                              className="small-action evidence-delete-confirm"
                              type="button"
                              disabled={isBusy}
                              onClick={() => void onDelete(document.documentId)}
                            >
                              {busy ? <ProcessingClock label="Deleting..." /> : "Confirm delete"}
                            </button>
                            <button className="small-action" type="button" onClick={() => setDeleteCandidate("")} disabled={isBusy}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button className="small-action evidence-delete-action" type="button" onClick={() => setDeleteCandidate(document.documentId)} disabled={isBusy}>
                            Delete
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="evidence-empty">
                <strong>No approved evidence yet</strong>
                <p>Add a bounded source to ground future handoffs and catch-up responses for this client.</p>
              </div>
            )}
          </section>
        </div>

        {error ? <div className="evidence-message evidence-message-error" role="alert">{error}</div> : null}
        {notice ? <div className="evidence-message" role="status" aria-live="polite">{notice}</div> : null}
      </section>
    </div>
  );
}
