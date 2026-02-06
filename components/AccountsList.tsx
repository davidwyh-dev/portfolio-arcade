"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { RetroCard } from "./ui/RetroCard";
import { RetroButton } from "./ui/RetroButton";
import { AccountForm } from "./AccountForm";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { AccountType } from "@/lib/constants";

export function AccountsList() {
  const accounts = useQuery(api.accounts.list);
  const removeAccount = useMutation(api.accounts.remove);

  const [formOpen, setFormOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<
    | {
        _id: Id<"accounts">;
        name: string;
        accountType: AccountType;
        taxDeferred: boolean;
        institution: string;
      }
    | undefined
  >(undefined);
  const [deleteError, setDeleteError] = useState("");

  const handleEdit = (account: NonNullable<typeof accounts>[number]) => {
    setEditAccount({
      _id: account._id,
      name: account.name,
      accountType: account.accountType,
      taxDeferred: account.taxDeferred,
      institution: account.institution,
    });
    setFormOpen(true);
  };

  const handleDelete = async (id: Id<"accounts">) => {
    setDeleteError("");
    try {
      await removeAccount({ id });
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete account"
      );
    }
  };

  const handleClose = () => {
    setFormOpen(false);
    setEditAccount(undefined);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-retro text-xs text-neon-magenta">ACCOUNTS</h2>
        <RetroButton
          size="sm"
          variant="secondary"
          onClick={() => {
            setEditAccount(undefined);
            setFormOpen(true);
          }}
        >
          <Plus size={14} className="mr-1 inline" />
          ADD ACCOUNT
        </RetroButton>
      </div>

      {deleteError && (
        <div className="mb-4 rounded border border-neon-red/30 bg-neon-red/5 p-3">
          <p className="font-terminal text-sm text-neon-red">{deleteError}</p>
        </div>
      )}

      {!accounts ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <RetroCard key={i} glowColor="magenta" className="animate-pulse">
              <div className="h-16" />
            </RetroCard>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <RetroCard glowColor="magenta">
          <p className="text-center font-terminal text-lg text-foreground/30">
            NO ACCOUNTS YET — INSERT COIN TO START
          </p>
        </RetroCard>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <RetroCard key={account._id} glowColor="magenta">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-mono text-sm font-medium text-foreground">
                    {account.name}
                  </h3>
                  <p className="mt-1 font-terminal text-base text-neon-magenta/70">
                    {account.accountType}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Building2 size={12} className="text-foreground/30" />
                    <span className="font-terminal text-base text-foreground/40">
                      {account.institution}
                    </span>
                  </div>
                  {account.taxDeferred && (
                    <span className="mt-1 inline-block rounded bg-neon-yellow/10 px-1.5 py-0.5 font-terminal text-xs text-neon-yellow">
                      TAX-DEFERRED
                    </span>
                  )}
                </div>
                <div className="ml-2 flex gap-1">
                  <button
                    onClick={() => handleEdit(account)}
                    className="p-1 text-foreground/30 transition-colors hover:text-neon-cyan"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => void handleDelete(account._id)}
                    className="p-1 text-foreground/30 transition-colors hover:text-neon-red"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </RetroCard>
          ))}
        </div>
      )}

      <AccountForm
        isOpen={formOpen}
        onClose={handleClose}
        editAccount={editAccount}
      />
    </div>
  );
}
