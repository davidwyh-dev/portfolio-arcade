"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { RetroModal } from "./ui/RetroModal";
import { RetroButton } from "./ui/RetroButton";
import { Download, Upload, AlertCircle, CheckCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface InvestmentBulkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ErrorSummary {
  [key: string]: number;
}

export function InvestmentBulkModal({
  isOpen,
  onClose,
}: InvestmentBulkModalProps) {
  const investments = useQuery(api.investments.list);
  const accounts = useQuery(api.accounts.list);
  const bulkCreate = useMutation(api.investments.bulkCreate);
  
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [errorSummary, setErrorSummary] = useState<ErrorSummary>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV Headers
  const CSV_HEADERS = [
    "ticker",
    "accountName",
    "dateAcquired",
    "dateSold",
    "units",
    "unitPrice",
    "soldUnitPrice",
    "currency",
  ];

  // Convert investments to CSV format
  const convertToCSV = () => {
    if (!investments) return "";

    const headers = CSV_HEADERS.join(",");
    const rows = investments.map((inv) => {
      return [
        inv.ticker,
        inv.accountName,
        inv.dateAcquired,
        inv.dateSold || "",
        inv.units,
        inv.unitPrice ?? (inv.units > 0 ? inv.costBasis / inv.units : 0),
        inv.soldUnitPrice || "",
        inv.currency,
      ]
        .map((value) => {
          // Escape commas and quotes in values
          const stringValue = String(value);
          if (stringValue.includes(",") || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(",");
    });

    return [headers, ...rows].join("\n");
  };

  // Download CSV file
  const handleDownload = () => {
    const csvContent = convertToCSV();
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `investments_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse CSV content
  const parseCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentValue = "";
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentValue += '"';
          i++; // Skip next quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === "," && !insideQuotes) {
        currentRow.push(currentValue.trim());
        currentValue = "";
      } else if ((char === "\n" || char === "\r") && !insideQuotes) {
        if (char === "\r" && nextChar === "\n") {
          i++; // Skip \n in \r\n
        }
        if (currentValue || currentRow.length > 0) {
          currentRow.push(currentValue.trim());
          if (currentRow.some((val) => val)) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentValue = "";
        }
      } else {
        currentValue += char;
      }
    }

    // Add last value and row if exists
    if (currentValue || currentRow.length > 0) {
      currentRow.push(currentValue.trim());
      if (currentRow.some((val) => val)) {
        rows.push(currentRow);
      }
    }

    return rows;
  };

  // Validate CSV data
  const validateCSVData = (rows: string[][]): ValidationError[] => {
    const errors: ValidationError[] = [];
    
    if (rows.length === 0) {
      errors.push({
        row: 0,
        field: "file",
        message: "CSV file is empty",
      });
      return errors;
    }

    // Validate headers
    const headers = rows[0].map((h) => h.toLowerCase().trim());
    const requiredHeaders = ["ticker", "accountname", "dateacquired", "units", "unitprice", "currency"];
    
    for (const required of requiredHeaders) {
      if (!headers.includes(required)) {
        errors.push({
          row: 0,
          field: "headers",
          message: `Missing required header: ${required}`,
        });
      }
    }

    if (errors.length > 0) return errors;

    // Validate data rows
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      // Ticker validation
      const ticker = row[headers.indexOf("ticker")]?.trim();
      if (!ticker) {
        errors.push({
          row: rowNum,
          field: "ticker",
          message: "Ticker is required",
        });
      }

      // Account validation
      const accountName = row[headers.indexOf("accountname")]?.trim();
      if (!accountName) {
        errors.push({
          row: rowNum,
          field: "accountName",
          message: "Account name is required",
        });
      } else if (accounts && !accounts.some((a) => a.name === accountName)) {
        errors.push({
          row: rowNum,
          field: "accountName",
          message: `Account '${accountName}' not found`,
        });
      }

      // Date validation
      const dateAcquired = row[headers.indexOf("dateacquired")]?.trim();
      if (!dateAcquired) {
        errors.push({
          row: rowNum,
          field: "dateAcquired",
          message: "Date acquired is required",
        });
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(dateAcquired)) {
        errors.push({
          row: rowNum,
          field: "dateAcquired",
          message: "Date must be in YYYY-MM-DD format",
        });
      }

      // Optional date sold validation
      const dateSold = row[headers.indexOf("datesold")]?.trim();
      if (dateSold && !/^\d{4}-\d{2}-\d{2}$/.test(dateSold)) {
        errors.push({
          row: rowNum,
          field: "dateSold",
          message: "Date sold must be in YYYY-MM-DD format",
        });
      }

      // Units validation
      const units = row[headers.indexOf("units")]?.trim();
      if (!units) {
        errors.push({
          row: rowNum,
          field: "units",
          message: "Units is required",
        });
      } else if (isNaN(parseFloat(units)) || parseFloat(units) <= 0) {
        errors.push({
          row: rowNum,
          field: "units",
          message: "Units must be a positive number",
        });
      }

      // Unit price validation
      const unitPrice = row[headers.indexOf("unitprice")]?.trim();
      if (!unitPrice) {
        errors.push({
          row: rowNum,
          field: "unitPrice",
          message: "Unit price is required",
        });
      } else if (isNaN(parseFloat(unitPrice)) || parseFloat(unitPrice) <= 0) {
        errors.push({
          row: rowNum,
          field: "unitPrice",
          message: "Unit price must be a positive number",
        });
      }

      // Optional sold unit price validation
      const soldUnitPrice = row[headers.indexOf("soldunitprice")]?.trim();
      if (soldUnitPrice && (isNaN(parseFloat(soldUnitPrice)) || parseFloat(soldUnitPrice) <= 0)) {
        errors.push({
          row: rowNum,
          field: "soldUnitPrice",
          message: "Sold unit price must be a positive number",
        });
      }

      // Currency validation
      const currency = row[headers.indexOf("currency")]?.trim();
      if (!currency) {
        errors.push({
          row: rowNum,
          field: "currency",
          message: "Currency is required",
        });
      } else if (currency.length !== 3) {
        errors.push({
          row: rowNum,
          field: "currency",
          message: "Currency must be a 3-letter code (e.g., USD)",
        });
      }
    }

    return errors;
  };

  // Aggregate errors by type
  const aggregateErrors = (errors: ValidationError[]): ErrorSummary => {
    const summary: ErrorSummary = {};
    errors.forEach((error) => {
      const key = `${error.field}: ${error.message}`;
      summary[key] = (summary[key] || 0) + 1;
    });
    return summary;
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadSuccess(false);
    setValidationErrors([]);
    setErrorSummary({});

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      
      // Validate data
      const errors = validateCSVData(rows);
      
      if (errors.length > 0) {
        setValidationErrors(errors);
        setErrorSummary(aggregateErrors(errors));
        setUploading(false);
        return;
      }

      // Parse and prepare data for upload
      const headers = rows[0].map((h) => h.toLowerCase().trim());
      const investmentsData = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const accountName = row[headers.indexOf("accountname")]?.trim();
        const account = accounts?.find((a) => a.name === accountName);

        if (!account) continue;

        const dateSold = row[headers.indexOf("datesold")]?.trim();
        const soldUnitPrice = row[headers.indexOf("soldunitprice")]?.trim();

        investmentsData.push({
          accountId: account._id,
          ticker: row[headers.indexOf("ticker")]?.trim().toUpperCase(),
          dateAcquired: row[headers.indexOf("dateacquired")]?.trim(),
          dateSold: dateSold || undefined,
          units: parseFloat(row[headers.indexOf("units")]?.trim()),
          unitPrice: parseFloat(row[headers.indexOf("unitprice")]?.trim()),
          soldUnitPrice: soldUnitPrice ? parseFloat(soldUnitPrice) : undefined,
          currency: row[headers.indexOf("currency")]?.trim().toUpperCase(),
        });
      }

      // Upload to backend
      await bulkCreate({ investments: investmentsData });
      
      setUploadSuccess(true);
      setTimeout(() => {
        onClose();
        setUploadSuccess(false);
      }, 2000);
    } catch (error) {
      setValidationErrors([
        {
          row: 0,
          field: "file",
          message: error instanceof Error ? error.message : "Failed to process file",
        },
      ]);
      setErrorSummary({ "File processing error": 1 });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <RetroModal
      isOpen={isOpen}
      onClose={onClose}
      title="BULK INVESTMENTS MANAGEMENT"
    >
      <div className="flex flex-col gap-4">
        {/* Action Buttons */}
        <div className="flex gap-3">
          <RetroButton
            onClick={handleDownload}
            disabled={!investments || investments.length === 0}
            className="flex-1"
            variant="primary"
          >
            <Download size={14} className="mr-2 inline" />
            DOWNLOAD CSV
          </RetroButton>
          <RetroButton
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-1"
            variant="secondary"
          >
            <Upload size={14} className="mr-2 inline" />
            {uploading ? "UPLOADING..." : "UPLOAD CSV"}
          </RetroButton>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Success Message */}
        {uploadSuccess && (
          <div className="flex items-center gap-2 rounded border border-neon-green/30 bg-neon-green/10 p-3">
            <CheckCircle size={16} className="text-neon-green" />
            <span className="font-terminal text-sm text-neon-green">
              Upload successful! {validationErrors.length === 0 ? "All investments created." : ""}
            </span>
          </div>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && !uploadSuccess && (
          <div className="max-h-64 overflow-y-auto rounded border border-neon-red/30 bg-neon-red/10 p-3">
            <div className="mb-2 flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-neon-red" />
              <div className="flex-1">
                <p className="font-terminal text-sm font-bold text-neon-red">
                  VALIDATION FAILED: {validationErrors.length} error{validationErrors.length !== 1 ? "s" : ""} found
                </p>
                
                {/* Error Summary */}
                <div className="mt-3 space-y-1">
                  <p className="font-terminal text-xs text-neon-red/80">ERROR SUMMARY:</p>
                  {Object.entries(errorSummary).map(([error, count]) => (
                    <div key={error} className="font-mono text-xs text-neon-red/70">
                      <span className="font-bold">×{count}</span> - {error}
                    </div>
                  ))}
                </div>

                {/* Detailed Errors */}
                <details className="mt-3">
                  <summary className="cursor-pointer font-terminal text-xs text-neon-red/80 hover:text-neon-red">
                    Show detailed errors
                  </summary>
                  <div className="mt-2 space-y-1">
                    {validationErrors.slice(0, 50).map((error, idx) => (
                      <div key={idx} className="font-mono text-xs text-neon-red/70">
                        Row {error.row}: [{error.field}] {error.message}
                      </div>
                    ))}
                    {validationErrors.length > 50 && (
                      <div className="font-mono text-xs text-neon-red/50">
                        ... and {validationErrors.length - 50} more errors
                      </div>
                    )}
                  </div>
                </details>
              </div>
            </div>
          </div>
        )}

        {/* Investment Data Table */}
        <div className="rounded border border-border-dim bg-background/50">
          <div className="border-b border-border-dim px-3 py-2">
            <h3 className="font-terminal text-xs text-foreground/60">
              CURRENT INVESTMENTS ({investments?.length || 0})
            </h3>
          </div>
          <div className="max-h-96 overflow-auto">
            {!investments ? (
              <div className="p-4 text-center font-terminal text-sm text-foreground/30">
                LOADING...
              </div>
            ) : investments.length === 0 ? (
              <div className="p-4 text-center font-terminal text-sm text-foreground/30">
                NO INVESTMENTS YET
              </div>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border-dim">
                    <th className="px-2 py-2 text-left font-terminal text-xs text-foreground/40">
                      TICKER
                    </th>
                    <th className="px-2 py-2 text-left font-terminal text-xs text-foreground/40">
                      ACCOUNT
                    </th>
                    <th className="px-2 py-2 text-left font-terminal text-xs text-foreground/40">
                      ACQUIRED
                    </th>
                    <th className="px-2 py-2 text-right font-terminal text-xs text-foreground/40">
                      UNITS
                    </th>
                    <th className="px-2 py-2 text-right font-terminal text-xs text-foreground/40">
                      UNIT $
                    </th>
                    <th className="px-2 py-2 text-right font-terminal text-xs text-foreground/40">
                      CURRENCY
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {investments.map((inv) => (
                    <tr
                      key={inv._id}
                      className="border-b border-border-dim/50 transition-colors hover:bg-surface/50"
                    >
                      <td className="px-2 py-2 font-mono text-xs text-neon-cyan">
                        {inv.ticker}
                      </td>
                      <td className="px-2 py-2 font-terminal text-xs text-foreground/60">
                        {inv.accountName}
                      </td>
                      <td className="px-2 py-2 font-terminal text-xs text-foreground/50">
                        {formatDate(inv.dateAcquired)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-xs text-foreground/60">
                        {inv.units.toLocaleString()}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-xs text-foreground/60">
                        {formatCurrency(
                          inv.unitPrice ?? (inv.units > 0 ? inv.costBasis / inv.units : 0),
                          inv.currency
                        )}
                      </td>
                      <td className="px-2 py-2 text-right font-terminal text-xs text-foreground/50">
                        {inv.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* CSV Format Info */}
        <div className="rounded border border-border-dim/50 bg-background/30 p-3">
          <p className="mb-1 font-terminal text-xs text-foreground/40">
            CSV FORMAT REQUIREMENTS:
          </p>
          <ul className="ml-4 list-disc space-y-0.5 font-mono text-xs text-foreground/30">
            <li>Headers: ticker, accountName, dateAcquired, dateSold, units, unitPrice, soldUnitPrice, currency</li>
            <li>Dates must be in YYYY-MM-DD format</li>
            <li>Account names must match existing accounts</li>
            <li>Optional fields: dateSold, soldUnitPrice</li>
          </ul>
        </div>
      </div>
    </RetroModal>
  );
}
