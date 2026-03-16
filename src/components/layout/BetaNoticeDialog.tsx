"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/useLocale";
import { BETA_NOTICE_DISMISSED_KEY, GITHUB_ISSUES_URL } from "@/lib/constants";

export function BetaNoticeDialog() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(BETA_NOTICE_DISMISSED_KEY);
    if (dismissed !== "true") {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(BETA_NOTICE_DISMISSED_KEY, "true");
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("betaTitle")}</DialogTitle>
          <DialogDescription>{t("betaDescription")}</DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          {t("betaFeedback")}
        </p>
        <a
          href={GITHUB_ISSUES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline hover:opacity-80"
        >
          GitHub Issues
        </a>
        <p className="text-xs text-muted-foreground">
          {t("betaIssuesHint")}
        </p>
        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded"
            />
            {t("betaDontShowAgain")}
          </label>
          <Button onClick={handleClose}>{t("betaClose")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
