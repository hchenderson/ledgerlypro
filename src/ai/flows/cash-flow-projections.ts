'use server';

/**
 * @fileOverview AI-driven cash flow projections based on historical transaction data.
 *
 * - getCashFlowProjections - A function that generates cash flow projections.
 * - GetCashFlowProjectionsInput - The input type for the getCashFlowProjections function.
 * - GetCashFlowProjectionsOutput - The return type for the getCashFlowProjections function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GetCashFlowProjectionsInputSchema = z.object({
  historicalData: z
    .string()
    .describe(
      'Historical transaction data in JSON format.  Each transaction should include date, amount, and category.'
    ),
});
export type GetCashFlowProjectionsInput = z.infer<
  typeof GetCashFlowProjectionsInputSchema
>;

const GetCashFlowProjectionsOutputSchema = z.object({
  projection: z
    .string()
    .describe(
      'AI-driven cash flow projections based on historical transaction data.'
    ),
});
export type GetCashFlowProjectionsOutput = z.infer<
  typeof GetCashFlowProjectionsOutputSchema
>;

export async function getCashFlowProjections(
  input: GetCashFlowProjectionsInput
): Promise<GetCashFlowProjectionsOutput> {
  return cashFlowProjectionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'cashFlowProjectionsPrompt',
  input: {schema: GetCashFlowProjectionsInputSchema},
  output: {schema: GetCashFlowProjectionsOutputSchema},
  prompt: `You are a financial expert providing cash flow projections based on historical data.

  Analyze the following historical transaction data and provide a cash flow projection.
  Historical Data: {{{historicalData}}}
  
  Provide a concise projection, highlighting key trends and potential future financial needs.
  Your analysis MUST be based on the provided data.
  The projection should be formatted as a string.`, // Enforce string format
});

const cashFlowProjectionsFlow = ai.defineFlow(
  {
    name: 'cashFlowProjectionsFlow',
    inputSchema: GetCashFlowProjectionsInputSchema,
    outputSchema: GetCashFlowProjectionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
