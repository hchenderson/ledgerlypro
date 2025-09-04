
"use client";

import { useState, useRef, useEffect } from 'react';
import { Camera, Loader2, Sparkles, Upload, CheckCircle, AlertTriangle, Video, Power, Capture } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { scanReceipt, ScanReceiptOutput } from '@/ai/flows/scan-receipt-flow';
import { useToast } from '@/hooks/use-toast';
import { NewTransactionSheet } from '@/components/new-transaction-sheet';
import type { Transaction } from '@/types';
import { useUserData } from '@/hooks/use-user-data';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

export default function ReceiptScannerPage() {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [extractedData, setExtractedData] = useState<ScanReceiptOutput | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    const { addTransaction, categories } = useUserData();
    const { toast } = useToast();

    useEffect(() => {
        const getCameraPermission = async () => {
            if (isCameraOpen) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                    setHasCameraPermission(true);
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                } catch (error) {
                    console.error('Error accessing camera:', error);
                    setHasCameraPermission(false);
                    toast({
                        variant: 'destructive',
                        title: 'Camera Access Denied',
                        description: 'Please enable camera permissions in your browser settings.',
                    });
                }
            } else {
                // Stop camera stream when not in use
                 if (videoRef.current && videoRef.current.srcObject) {
                    const stream = videoRef.current.srcObject as MediaStream;
                    stream.getTracks().forEach(track => track.stop());
                    videoRef.current.srcObject = null;
                }
            }
        };
        getCameraPermission();
        
        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        }
    }, [isCameraOpen, toast]);
    

    const resetState = () => {
        setFile(null);
        setPreview(null);
        setIsLoading(false);
        setExtractedData(null);
        setError(null);
        setIsCameraOpen(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            resetState();
            setFile(selectedFile);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(selectedFile);
        }
    };
    
     const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            const dataUrl = canvas.toDataURL('image/jpeg');
            resetState();
            setPreview(dataUrl);
        }
    };


    const handleScanReceipt = async () => {
        if (!preview) {
            toast({ variant: 'destructive', title: 'No image selected.' });
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
       resetState();
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
                Upload a photo or use your camera to let AI do the hard work.
                </p>
            </div>
            
             <Card>
                <CardHeader>
                    <CardTitle>1. Choose Input</CardTitle>
                    <CardDescription>Select a photo of your receipt or use your device's camera.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <label className={cn("flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted transition-colors", isCameraOpen && "opacity-50 cursor-not-allowed")}>
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                        <p className="mb-2 text-sm text-muted-foreground">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, or WEBP (MAX. 5MB)</p>
                        </div>
                        <input type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} disabled={isCameraOpen}/>
                    </label>
                     <div className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg bg-muted/50">
                        <div className="flex flex-col items-center justify-center">
                            <Video className="w-10 h-10 mb-3 text-muted-foreground"/>
                            <p className="mb-2 text-sm text-muted-foreground text-center">Use your device's camera</p>
                             <Button onClick={() => setIsCameraOpen(p => !p)} variant={isCameraOpen ? "destructive" : "default"}>
                                {isCameraOpen ? <><Power className="mr-2 h-4 w-4" /> Close Camera</> : <><Camera className="mr-2 h-4 w-4" /> Open Camera</>}
                            </Button>
                        </div>
                     </div>
                </CardContent>
            </Card>

             {isCameraOpen && (
                <Card>
                    <CardHeader>
                        <CardTitle>Live Camera Feed</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative aspect-video bg-black rounded-md overflow-hidden border">
                             <video ref={videoRef} className="w-full h-full object-contain" autoPlay muted playsInline />
                             <canvas ref={canvasRef} className="hidden" />
                             {hasCameraPermission === false && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                    <Alert variant="destructive" className="w-auto">
                                        <AlertTitle>Camera Access Denied</AlertTitle>
                                        <AlertDescription>Please enable camera permissions.</AlertDescription>
                                    </Alert>
                                </div>
                            )}
                        </div>
                        <Button onClick={handleCapture} disabled={!hasCameraPermission} className="w-full">
                            <Capture className="mr-2 h-4 w-4" /> Capture Photo
                        </Button>
                    </CardContent>
                </Card>
            )}

            {(preview || isLoading || extractedData || error) && (
                <Card>
                    <CardHeader>
                        <CardTitle>2. Review & Create</CardTitle>
                        <CardDescription>Analyze the receipt and create a transaction.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        {preview && (
                            <div className="space-y-4">
                               <h3 className="font-medium">Image Preview</h3>
                               <img src={preview} alt="Receipt preview" className="rounded-lg border object-contain w-full" />
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
