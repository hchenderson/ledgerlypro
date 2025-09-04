
"use client";

import { useState } from 'react';
import { Camera, Loader2, Sparkles, Upload, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { scanReceipt, ScanReceiptOutput } from '@/ai/flows/scan-receipt-flow';
import { useToast } from '@/hooks/use-toast';
import { NewTransactionSheet } from '@/components/new-transaction-sheet';
import type { Transaction } from '@/types';
import { useUserData } from '@/hooks/use-user-data';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function ReceiptScannerPage() {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [extractedData, setExtractedData] = useState<ScanReceiptOutput | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const { addTransaction, categories } = useUserData();
    const { toast } = useToast();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setExtractedData(null);
            setError(null);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(selectedFile);
        }
    };

    const handleScanReceipt = async () => {
        if (!file || !preview) {
            toast({ variant: 'destructive', title: 'No file selected.' });
            return;
        }
        setIsLoading(true);
        setError(null);
        setExtractedData(null);

        try {
            const result = await scanReceipt({ receiptImage: preview });
            setExtractedData(result);
            toast({
                title: 'Scan Successful!',
                description: 'Review the extracted data and create your transaction.',
            });
        } catch (e) {
            console.error(e);
            setError('Failed to scan the receipt. The AI model might be unable to read this image. Please try another one.');
            toast({ variant: 'destructive', title: 'Scan Failed' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleTransactionCreated = (values: Omit<Transaction, 'id' | 'type'> & { type: "income" | "expense" }) => {
        const newTransaction: Transaction = {
         id: `txn_${Date.now()}`,
         ...values,
         date: values.date.toISOString()
       };
       addTransaction(newTransaction);
       // Reset state after transaction is created
       setFile(null);
       setPreview(null);
       setExtractedData(null);
     }

    return (
        <>
        <div className="space-y-6 max-w-4xl mx-auto">
             <div className="text-center">
                <Camera className="mx-auto h-12 w-12 text-primary" />
                <h1 className="mt-4 font-headline text-3xl font-bold tracking-tight sm:text-4xl">
                Receipt Scanner
                </h1>
                <p className="mt-4 text-lg text-muted-foreground">
                Upload an image of your receipt and let AI do the hard work.
                </p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>1. Upload Receipt</CardTitle>
                    <CardDescription>Select or drag and drop a clear photo of your receipt.</CardDescription>
                </CardHeader>
                <CardContent>
                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                        <p className="mb-2 text-sm text-muted-foreground">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, or WEBP (MAX. 5MB)</p>
                        </div>
                        <input type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange}/>
                    </label>
                </CardContent>
            </Card>

            {(preview || isLoading || extractedData || error) && (
                <Card>
                    <CardHeader>
                        <CardTitle>2. Review & Create</CardTitle>
                        <CardDescription>Analyze the receipt and create a transaction.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        {preview && (
                            <div className="space-y-4">
                               <h3 className="font-medium">Receipt Preview</h3>
                               <img src={preview} alt="Receipt preview" className="rounded-lg border object-contain" />
                                <Button onClick={handleScanReceipt} disabled={isLoading || !!extractedData} className="w-full">
                                    {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</> : <><Sparkles className="mr-2 h-4 w-4" /> Scan with AI</>}
                                </Button>
                            </div>
                        )}
                        <div className="space-y-4">
                            <h3 className="font-medium">Extracted Data</h3>
                            {isLoading && (
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">AI is reading your receipt...</p>
                                    <div className="h-24 w-full bg-muted rounded-md animate-pulse"></div>
                                </div>
                            )}
                             {error && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Scan Error</AlertTitle>
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                            {extractedData && (
                                <>
                                <Alert variant="default" className="bg-primary/5">
                                    <CheckCircle className="h-4 w-4 text-primary" />
                                    <AlertTitle>Scan Complete!</AlertTitle>
                                    <AlertDescription>
                                        <ul className="mt-2 list-disc list-inside">
                                            <li><strong>Date:</strong> {extractedData.date}</li>
                                            <li><strong>Amount:</strong> {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(extractedData.amount)}</li>
                                            <li><strong>Description:</strong> {extractedData.description}</li>
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                                <Button onClick={() => setIsSheetOpen(true)} className="w-full">
                                    Create Transaction
                                </Button>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
        <NewTransactionSheet 
            isOpen={isSheetOpen}
            onOpenChange={setIsSheetOpen}
            transaction={extractedData ? {
                id: '', // Temporary ID
                amount: extractedData.amount,
                date: new Date(extractedData.date).toISOString(),
                description: extractedData.description,
                type: 'expense',
                category: ''
            } : null}
            onTransactionCreated={handleTransactionCreated}
            categories={categories}
        />
        </>
    )
}
