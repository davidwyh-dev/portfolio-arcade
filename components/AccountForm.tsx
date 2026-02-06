"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { RetroInput } from "./ui/RetroInput";
import { RetroCombobox } from "./ui/RetroCombobox";
import { RetroCheckbox } from "./ui/RetroCheckbox";
import { RetroButton } from "./ui/RetroButton";
import { RetroModal } from "./ui/RetroModal";
import {
  ACCOUNT_TYPES,
  INSTITUTIONS,
  TAX_DEFERRED_DEFAULTS,
  AccountType,
} from "@/lib/constants";

interface AccountFormProps {
  isOpen: boolean;
  onClose: () => void;
  editAccount?: {
    _id: Id<"accounts">;
    name: string;
    accountType: AccountType;
    taxDeferred: boolean;
    institution: string;
  };
}

export function AccountForm({ isOpen, onClose, editAccount }: AccountFormProps) {
  const createAccount = useMutation(api.accounts.create);
  const updateAccount = useMutation(api.accounts.update);

  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("Investment");
  const [taxDeferred, setTaxDeferred] = useState(false);
  const [institution, setInstitution] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editAccount) {
      setName(editAccount.name);
      setAccountType(editAccount.accountType);
      setTaxDeferred(editAccount.taxDeferred);
      setInstitution(editAccount.institution);
    } else {
      setName("");
      setAccountType("Investment");
      setTaxDeferred(false);
      setInstitution("");
    }
    setError("");
  }, [editAccount, isOpen]);

  const handleAccountTypeChange = (type: AccountType) => {
    setAccountType(type);
    if (type in TAX_DEFERRED_DEFAULTS) {
      setTaxDeferred(TAX_DEFERRED_DEFAULTS[type]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !institution) {
      setError("All fields are required");
      return;
    }
    setLoading(true);
    setError("");

    try {
      if (editAccount) {
        await updateAccount({
          id: editAccount._id,
          name,
          accountType,
          taxDeferred,
          institution,
        });
      } else {
        await createAccount({
          name,
          accountType,
          taxDeferred,
          institution,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <RetroModal
      isOpen={isOpen}
      onClose={onClose}
      title={editAccount ? "EDIT ACCOUNT" : "NEW ACCOUNT"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <RetroInput
          label="ACCOUNT NAME"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My 401k"
          required
        />
        <RetroCombobox
          label="ACCOUNT TYPE"
          value={accountType}
          onChange={(val) => handleAccountTypeChange(val)}
          options={[...ACCOUNT_TYPES]}
          placeholder="Type or select account type..."
        />
        <RetroCheckbox
          label="Tax-Deferred"
          checked={taxDeferred}
          onChange={(e) => setTaxDeferred(e.target.checked)}
        />
        <RetroCombobox
          label="INSTITUTION"
          value={institution}
          onChange={(val) => setInstitution(val)}
          options={[...INSTITUTIONS]}
          placeholder="Type or select institution..."
        />

        {error && (
          <p className="font-terminal text-sm text-neon-red">{error}</p>
        )}

        <div className="mt-2 flex gap-3">
          <RetroButton type="submit" disabled={loading} className="flex-1">
            {loading ? "SAVING..." : editAccount ? "UPDATE" : "CREATE"}
          </RetroButton>
          <RetroButton
            type="button"
            variant="secondary"
            onClick={onClose}
            className="flex-1"
          >
            CANCEL
          </RetroButton>
        </div>
      </form>
    </RetroModal>
  );
}
