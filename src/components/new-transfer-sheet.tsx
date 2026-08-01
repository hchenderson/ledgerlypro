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
  })
  .refine(
    (values) =>
      values.sourceAccountId !== values.destinationAccountId,
    {
      message: "Choose two different accounts.",
      path: ["destinationAccountId"],
    },
  );

type TransferFormValues = z.infer<typeof transferSchema>;

export function NewTransferSheet({
  isOpen,
  onOpenChange,
  onTransferCreated,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTransferCreated: (transfer: TransferInput) => Promise<void>;
}) {
  const {
    activeAccounts,
    primaryAccountId,
    selectedAccountIds,
  } = useAccounts();
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
  });

  useEffect(() => {
    if (!isOpen) return;
    setSubmitError(null);
    const sourceAccountId =
      selectedAccountIds.length === 1 &&
      activeAccounts.some(
        (account) => account.id === selectedAccountIds[0],
      )
        ? selectedAccountIds[0]
        : primaryAccountId ?? activeAccounts[0]?.id ?? "";
    form.reset({
      sourceAccountId,
      destinationAccountId:
        activeAccounts.find(
          (account) => account.id !== sourceAccountId,
        )?.id ?? "",
      amount: "" as unknown as number,
      date: new Date(),
      description: "",
    });
  }, [
    activeAccounts,
    form,
    isOpen,
    primaryAccountId,
    selectedAccountIds,
  ]);

  const sourceAccountId = form.watch("sourceAccountId");

  const onSubmit = async (values: TransferFormValues) => {
    setIsSaving(true);
    setSubmitError(null);
    try {
      await onTransferCreated({
        ...values,
        amount: Math.abs(values.amount),
        date: values.date.toISOString(),
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
