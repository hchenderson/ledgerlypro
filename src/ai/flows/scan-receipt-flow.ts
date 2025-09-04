'use server';
/**
 * @fileOverview An AI agent for scanning receipts.
 *
 * - scanReceipt - A function that handles scanning a receipt image and extracting transaction data.
 * - ScanReceiptInput - The input type for the scanReceipt function.
 * - ScanReceiptOutput - The return type for the scanReceipt function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ScanReceiptInputSchema = z.object({
  receiptImage: z
    .string()
    .describe(
      "A photo of a receipt, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ScanReceiptInput = z.infer<typeof ScanReceiptInputSchema>;

const ScanReceiptOutputSchema = z.object({
  date: z.string().describe("The date of the transaction in YYYY-MM-DD format."),
  amount: z.number().describe("The total amount of the transaction."),
  description: z.string().describe("A brief description or name of the vendor/store."),
});
export type ScanReceiptOutput = z.infer<typeof ScanReceiptOutputSchema>;

export async function scanReceipt(input: ScanReceiptInput): Promise<ScanReceiptOutput> {
  return scanReceiptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'scanReceiptPrompt',
  input: {schema: ScanReceiptInputSchema},
  output: {schema: ScanReceiptOutputSchema},
  prompt: `You are an expert receipt scanner. Analyze the provided image of a receipt and extract the following information: the transaction date, the total amount, and the vendor/store name to be used as a description.

  - The date should be in YYYY-MM-DD format. If the year is not present, assume the current year.
  - The amount should be the final total, including taxes and tips.
  - The description should be the name of the store or vendor.

  Here is the receipt image: {{media url=receiptImage}}`,
});

const scanReceiptFlow = ai.defineFlow(
  {
    name: 'scanReceiptFlow',
    inputSchema: ScanReceiptInputSchema,
    outputSchema: ScanReceiptOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
