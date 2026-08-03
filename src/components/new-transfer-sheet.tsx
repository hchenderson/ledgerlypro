"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { ArrowRightLeft, Calendar as CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAccounts } from "@/hooks/use-accounts";
import { useAuth } from "@/hooks/use-auth";
import { useEnvelopes } from "@/hooks/use-envelopes";
import type { TransferInput } from "@/lib/accounts";
import { cn } from "@/lib/utils";

const transferSchema = z
  .object({
    sourceAccountId: z.string().min(1, "Select a source account."),
    destinationAccountId: z
      .string()
      .min(1, "Select a destination account."),
    amount: z.coerce
      .number()
      .positive("Amount must be greater than zero."),
    date: z.date(),
    description: z.string().max(120).optional(),
    purpose: z.enum([
      "ordinary",
      "fund-envelope",
      "release-to-spend",
      "return-unused",
      "unassign",
      "reallocate",
    ]),
    envelopeId: z.string().optional(),
    relatedEnvelopeId: z.string().optional(),
  })
  .refine(
    (values) =>
      values.sourceAccountId !== values.destinationAccountId,
    {
      message: "Choose two different accounts.",
      path: ["destinationAccountId"],
    },
  )
  .superRefine((values, context) => {
    if (values.purpose !== "ordinary" && !values.envelopeId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["envelopeId"],
        message: "Select the envelope this transfer belongs to.",
      });
    }
    if (
      values.purpose === "reallocate" &&
      (!values.relatedEnvelopeId ||
        values.relatedEnvelopeId === values.envelopeId)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["relatedEnvelopeId"],
        message: "Select a different destination envelope.",
      });
    }
  });

type TransferFormValues = z.infer<typeof transferSchema>;

export function NewTransferSheet({
  isOpen,
  onOpenChange,
  onTransferCreated,
  initialValues,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTransferCreated: (transfer: TransferInput) => Promise<void>;
  initialValues?: Partial<TransferInput>;
}) {
  const {
    activeAccounts,
    primaryAccountId,
    selectedAccountIds,
  } = useAccounts();
  const { budgetingMode } = useAuth();
  const { activeEnvelopes } = useEnvelopes();
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: { purpose: "ordinary" },
  });

  useEffect(() => {
    if (!isOpen) return;
    setSubmitError(null);
    const defaultSourceAccountId =
      selectedAccountIds.length === 1 &&
      activeAccounts.some(
        (account) => account.id === selectedAccountIds[0],
      )
        ? selectedAccountIds[0]
        : primaryAccountId ?? activeAccounts[0]?.id ?? "";
    const sourceAccountId =
      initialValues?.sourceAccountId ?? defaultSourceAccountId;
    form.reset({
      sourceAccountId,
      destinationAccountId:
        initialValues?.destinationAccountId ??
        activeAccounts.find(
          (account) => account.id !== sourceAccountId,
        )?.id ?? "",
      amount:
        initialValues?.amount ?? ("" as unknown as number),
      date: initialValues?.date
        ? new Date(initialValues.date)
        : new Date(),
      description: initialValues?.description ?? "",
      purpose: initialValues?.purpose ?? "ordinary",
      envelopeId: initialValues?.envelopeId,
      relatedEnvelopeId: initialValues?.relatedEnvelopeId,
    });
  }, [
    activeAccounts,
    form,
    isOpen,
    initialValues,
    primaryAccountId,
    selectedAccountIds,
  ]);

  const sourceAccountId = form.watch("sourceAccountId");
  const purpose = form.watch("purpose");
  const envelopeId = form.watch("envelopeId");

  const applyEnvelopeAccounts = (
    nextEnvelopeId: string,
    nextPurpose: TransferFormValues["purpose"] = purpose,
    relatedEnvelopeId?: string,
  ) => {
    const envelope = activeEnvelopes.find(
      (candidate) => candidate.id === nextEnvelopeId,
    );
    const relatedEnvelope = activeEnvelopes.find(
      (candidate) => candidate.id === relatedEnvelopeId,
    );
    if (!envelope?.backingAccountId || !primaryAccountId) return;
    if (
      nextPurpose === "fund-envelope" ||
      nextPurpose === "return-unused"
    ) {
      form.setValue("sourceAccountId", primaryAccountId);
      form.setValue(
        "destinationAccountId",
        envelope.backingAccountId,
        { shouldValidate: true },
      );
    } else if (
      nextPurpose === "release-to-spend" ||
      nextPurpose === "unassign"
    ) {
      form.setValue("sourceAccountId", envelope.backingAccountId);
      form.setValue("destinationAccountId", primaryAccountId, {
        shouldValidate: true,
      });
    } else if (
      nextPurpose === "reallocate" &&
      relatedEnvelope?.backingAccountId
    ) {
      form.setValue("sourceAccountId", envelope.backingAccountId);
      form.setValue(
        "destinationAccountId",
        relatedEnvelope.backingAccountId,
        { shouldValidate: true },
      );
    }
  };

  const onSubmit = async (values: TransferFormValues) => {
    setIsSaving(true);
    setSubmitError(null);
    try {
      await onTransferCreated({
        sourceAccountId: values.sourceAccountId,
        destinationAccountId: values.destinationAccountId,
        amount: Math.abs(values.amount),
        date: values.date.toISOString(),
        description: values.description,
        purpose: values.purpose,
        ...(values.purpose !== "ordinary" && values.envelopeId
          ? { envelopeId: values.envelopeId }
          : {}),
        ...(values.purpose === "reallocate" &&
        values.relatedEnvelopeId
          ? { relatedEnvelopeId: values.relatedEnvelopeId }
          : {}),
      });
      onOpenChange(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "The transfer could not be created. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transfer money
          </SheetTitle>
          <SheetDescription>
            Move money between accounts without counting it as income
            or an expense.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 py-5"
          >
            {budgetingMode !== "tracking" &&
            activeEnvelopes.length > 0 ? (
              <FormField
                control={form.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transfer purpose</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        const nextPurpose =
                          value as TransferFormValues["purpose"];
                        field.onChange(nextPurpose);
                        if (nextPurpose === "ordinary") {
                          form.setValue("envelopeId", undefined);
                          form.setValue("relatedEnvelopeId", undefined);
                        } else if (envelopeId) {
                          applyEnvelopeAccounts(
                            envelopeId,
                            nextPurpose,
                            form.getValues("relatedEnvelopeId"),
                          );
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ordinary">
                          Ordinary account transfer
                        </SelectItem>
                        <SelectItem value="fund-envelope">
                          Fund an envelope
                        </SelectItem>
                        <SelectItem value="release-to-spend">
                          Release envelope money to spend
                        </SelectItem>
                        <SelectItem value="return-unused">
                          Return unused money
                        </SelectItem>
                        <SelectItem value="unassign">
                          Unassign envelope money
                        </SelectItem>
                        <SelectItem value="reallocate">
                          Move between envelopes
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            {purpose !== "ordinary" ? (
              <FormField
                control={form.control}
                name="envelopeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {purpose === "reallocate"
                        ? "From envelope"
                        : "Envelope"}
                    </FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        applyEnvelopeAccounts(
                          value,
                          purpose,
                          form.getValues("relatedEnvelopeId"),
                        );
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an envelope" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeEnvelopes.map((envelope) => (
                          <SelectItem
                            key={envelope.id}
                            value={envelope.id}
                          >
                            {envelope.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            {purpose === "reallocate" ? (
              <FormField
                control={form.control}
                name="relatedEnvelopeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To envelope</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        if (envelopeId) {
                          applyEnvelopeAccounts(
                            envelopeId,
                            purpose,
                            value,
                          );
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Destination envelope" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeEnvelopes
                          .filter(
                            (envelope) => envelope.id !== envelopeId,
                          )
                          .map((envelope) => (
                            <SelectItem
                              key={envelope.id}
                              value={envelope.id}
                            >
                              {envelope.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            <FormField
              control={form.control}
              name="sourceAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (
                        form.getValues("destinationAccountId") ===
                        value
                      ) {
                        form.setValue(
                          "destinationAccountId",
                          activeAccounts.find(
                            (account) => account.id !== value,
                          )?.id ?? "",
                          { shouldValidate: true },
                        );
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Source account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeAccounts.map((account) => (
                        <SelectItem
                          key={account.id}
                          value={account.id}
                        >
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="destinationAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Destination account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeAccounts
                        .filter(
                          (account) =>
                            account.id !== sourceAccountId,
                        )
                        .map((account) => (
                          <SelectItem
                            key={account.id}
                            value={account.id}
                          >
                            {account.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "justify-start text-left font-normal",
                            !field.value &&
                              "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value
                            ? format(field.value, "PPP")
                            : "Select a date"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0"
                      align="start"
                    >
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date > new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Move to emergency savings"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {activeAccounts.length < 2 ? (
              <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Add a second active account before creating a
                transfer.
              </p>
            ) : null}
            {submitError ? (
              <p
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
              >
                {submitError}
              </p>
            ) : null}
            <SheetFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving || activeAccounts.length < 2}
              >
                {isSaving ? "Saving…" : "Create transfer"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
